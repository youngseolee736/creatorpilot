#!/usr/bin/env python3
"""Dependency-free Chrome DevTools workflow test for CreatorPilot."""

import base64
import json
import os
import socket
import struct
import time
import urllib.parse
import urllib.request
from pathlib import Path


expect_api_transcript = os.environ.get("CREATORPILOT_EXPECT_API_TRANSCRIPT") == "1"
expect_api_analysis = os.environ.get("CREATORPILOT_EXPECT_API_ANALYSIS") == "1"
expect_api_script = os.environ.get("CREATORPILOT_EXPECT_API_SCRIPT") == "1"
expect_api_review = os.environ.get("CREATORPILOT_EXPECT_API_REVIEW") == "1"
expect_api_storyboard = os.environ.get("CREATORPILOT_EXPECT_API_STORYBOARD") == "1"
expect_transcript_error = os.environ.get("CREATORPILOT_EXPECT_TRANSCRIPT_ERROR") == "1"
test_youtube_url = os.environ.get(
    "CREATORPILOT_TEST_YOUTUBE_URL",
    "https://youtube.com/watch?v=creatorpilot-demo",
)
api_base_url = os.environ.get("CREATORPILOT_API_BASE_URL", "http://127.0.0.1:8787")


def target_socket_url():
    with urllib.request.urlopen("http://127.0.0.1:9222/json/list") as response:
        targets = json.load(response)
    return next(target["webSocketDebuggerUrl"] for target in targets if target["type"] == "page")


class DevTools:
    def __init__(self, url):
        parsed = urllib.parse.urlparse(url)
        self.socket = socket.create_connection((parsed.hostname, parsed.port))
        key = "dGhlIHNhbXBsZSBub25jZQ=="
        request = (
            f"GET {parsed.path} HTTP/1.1\r\nHost: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.socket.sendall(request.encode())
        response = self._read_until(b"\r\n\r\n")
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            raise RuntimeError(f"WebSocket upgrade failed: {response!r}")
        self.next_id = 0
        self.events = []

    def _read_until(self, marker):
        data = b""
        while marker not in data:
            data += self.socket.recv(4096)
        return data

    def _recv_exact(self, length):
        data = b""
        while len(data) < length:
            chunk = self.socket.recv(length - len(data))
            if not chunk:
                raise EOFError("Chrome closed the DevTools socket")
            data += chunk
        return data

    def _send_frame(self, payload):
        payload = payload.encode()
        mask = os.urandom(4)
        length = len(payload)
        header = bytearray([0x81])
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
        masked = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        self.socket.sendall(bytes(header) + mask + masked)

    def _receive_frame(self):
        first, second = self._recv_exact(2)
        opcode = first & 0x0F
        length = second & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._recv_exact(8))[0]
        mask = self._recv_exact(4) if second & 0x80 else None
        payload = self._recv_exact(length)
        if mask:
            payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        if opcode == 0x9:
            return self._receive_frame()
        return payload.decode()

    def command(self, method, params=None):
        self.next_id += 1
        command_id = self.next_id
        self._send_frame(json.dumps({"id": command_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self._receive_frame())
            if message.get("id") == command_id:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})
            self.events.append(message)

    def evaluate(self, expression):
        result = self.command("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": True,
            "userGesture": True,
        })
        if "exceptionDetails" in result:
            raise AssertionError(result["exceptionDetails"].get("text", "Browser evaluation failed"))
        return result["result"].get("value")


browser = DevTools(target_socket_url())
browser.command("Runtime.enable")
browser.command("Log.enable")
browser.command("Page.enable")
browser.command("Accessibility.enable")
if expect_api_analysis or expect_api_script or expect_api_review or expect_api_storyboard:
    browser.command("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(window, 'CREATORPILOT_CONFIG', {"
        "configurable: false, get() { return Object.freeze({"
        f"services: {{transcript:'api',analysis:'api',script:'{'api' if expect_api_script else 'mock'}',review:'{'api' if expect_api_review else 'mock'}',storyboard:'{'api' if expect_api_storyboard else 'mock'}',video:'mock'}},"
        f"apiBaseUrl:{json.dumps(api_base_url)},renderPollIntervalMs:1500}}); }}, set() {{}} }});"
    })
browser.command("Emulation.setDeviceMetricsOverride", {
    "width": 1280, "height": 900, "deviceScaleFactor": 1, "mobile": False,
})


def evaluate(script):
    return browser.evaluate(script)


def click(selector):
    evaluate(f"document.querySelector({json.dumps(selector)}).click()")
    time.sleep(0.03)


def set_value(selector, value):
    evaluate(
        "(() => {"
        f"const field = document.querySelector({json.dumps(selector)});"
        f"field.value = {json.dumps(value)};"
        "field.dispatchEvent(new Event('input', {bubbles:true}));"
        "field.dispatchEvent(new Event('change', {bubbles:true}));"
        "})()"
    )


def wait_for(expression, label, timeout=4):
    end = time.time() + timeout
    while time.time() < end:
        if evaluate(expression):
            print(f"PASS: {label}")
            return
        time.sleep(0.04)
    raise AssertionError(f"Timed out: {label}")


def check(condition, label):
    if not condition:
        raise AssertionError(label)
    print(f"PASS: {label}")


evidence = Path(__file__).resolve().parents[2] / "docs" / "plans" / "completed" / "creatorpilot-evidence"
evidence.mkdir(parents=True, exist_ok=True)


def capture(name):
    screenshot = browser.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
    (evidence / f"creatorpilot-{name}.png").write_bytes(base64.b64decode(screenshot["data"]))


browser.command("Page.navigate", {"url": "http://127.0.0.1:4173/?fast=1#/dashboard"})
wait_for("Boolean(document.body?.textContent.includes('CreatorPilot'))", "application bootstraps")
evaluate("localStorage.removeItem('creatorpilot:v1')")
browser.command("Page.reload", {"ignoreCache": True})
wait_for("document.querySelectorAll('.project-row').length === 2", "dashboard renders seeded projects")
check(evaluate("document.body.textContent.includes('CreatorPilot')"), "CreatorPilot branding renders")
check(not evaluate("document.body.textContent.includes('RelocateAI')"), "dashboard has no RelocateAI language")
check(evaluate("document.activeElement.id === 'page-content'"), "route navigation moves focus to page content")
evaluate("document.querySelector('.skip-link').focus()")
check(evaluate("document.activeElement.classList.contains('skip-link')"), "skip link can receive keyboard focus")
browser.command("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Tab", "code": "Tab"})
browser.command("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Tab", "code": "Tab"})
check(evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'"), "keyboard focus is visibly styled")

# Empty state is a real reachable state for a new browser profile.
evaluate("localStorage.setItem('creatorpilot:v1', JSON.stringify({version:1,projects:[],activeProjectId:null}))")
browser.command("Page.reload", {"ignoreCache": True})
wait_for("Boolean(document.querySelector('.empty-state'))", "new-user empty state renders")
evaluate("localStorage.removeItem('creatorpilot:v1')")
browser.command("Page.reload", {"ignoreCache": True})
wait_for("document.querySelectorAll('.project-row').length === 2", "dashboard recovers seeded projects")

click("a[href='#/projects/new']")
wait_for("Boolean(document.querySelector('#reference-form'))", "new project route opens")
capture("new-project-1280")
set_value("#reference-url", test_youtube_url)
set_value("#project-topic", "Why the United States cannot abandon Taiwan")
set_value("#language", "English")
click("#reference-form button[type='submit']")

if expect_transcript_error:
    wait_for("Boolean(document.querySelector('#service-error'))", "transcript failure is shown in the existing error UI")
    check(evaluate("document.querySelector('#service-error').textContent.includes('transcript is not available')"), "transcript error is user-friendly")
    check(evaluate("document.querySelector('#service-error [data-action=\"retry-analysis\"]') !== null"), "transcript error offers retry")
    print("CreatorPilot transcript error browser check passed.")
    raise SystemExit(0)

wait_for("document.querySelectorAll('.structure-timeline li').length === 6", "reference analysis completes")
capture("analysis-1280")
check(evaluate("document.querySelectorAll('.pipeline-completed').length >= 2"), "transcript and analyst pipeline stages complete")
check(evaluate("(() => { const main = document.querySelector('.analysis-main').getBoundingClientRect(); const aside = document.querySelector('.analysis-aside').getBoundingClientRect(); return main.right <= aside.left + 1; })()"), "analysis columns do not overlap")
check(evaluate("[...document.querySelectorAll('.analysis-overview > div, .analysis-aside > section')].every((element) => element.scrollWidth <= element.clientWidth + 1)"), "long analysis text stays inside its container")
expected_transcript_label = "extracted transcript" if expect_api_transcript else "mock transcript"
check(evaluate(f"document.querySelector('.transcript-disclosure').textContent.includes({json.dumps(expected_transcript_label)})"), "transcript preview is available")
if expect_api_analysis:
    check(evaluate("document.body.textContent.includes('88% confidence')"), "real analysis confidence renders")
    check(evaluate("JSON.parse(localStorage.getItem('creatorpilot:v1')).projects[0].analysis.analysisId.startsWith('analysis_')"), "real normalized analysis persists")
    check(not evaluate("document.body.textContent.includes('Return one JSON object only')"), "system prompt is not displayed")
    if expect_api_storyboard:
        connection_label = "5 production services connected"
    elif expect_api_review:
        connection_label = "Transcript + analyst + writer + reviewer connected"
    else:
        connection_label = "Transcript + analyst + scriptwriter connected" if expect_api_script else "Transcript + analyst connected"
    check(evaluate(f"document.body.textContent.includes({json.dumps(connection_label)})"), "hybrid service state is labeled accurately")

click("[data-action='generate-script']")
expected_script_sections = 6 if expect_api_script else 7
wait_for(f"document.querySelectorAll('[data-script-section]').length === {expected_script_sections}", "original script generates")
if expect_api_script:
    check(evaluate("JSON.parse(localStorage.getItem('creatorpilot:v1')).projects[0].generatedScript.scriptId.startsWith('script_')"), "real Scriptwriter draft persists")
    click("[data-action='regenerate-script']")
    wait_for("document.querySelector('.editor-toolbar').textContent.includes('Draft 2')", "Scriptwriter revision creates version two")
    check(evaluate("JSON.parse(localStorage.getItem('creatorpilot:v1')).projects[0].generatedScript.supersedesScriptId.startsWith('script_')"), "revision lineage persists")
capture("script-1280")
set_value("#section-hook", "A single shipping lane can change the balance of an entire region.")
click("#script-form button[type='submit']")

wait_for("document.querySelectorAll('.score-ring').length === 4", "originality review completes")
capture("review-1280")
check(evaluate("document.querySelectorAll('.comparison-item').length === 2"), "phrase comparison evidence renders")
check(evaluate("document.body.textContent.includes('not a copyright or legal determination')"), "review includes non-legal disclaimer")
check(evaluate("JSON.parse(localStorage.getItem('creatorpilot:v1')).projects[0].generatedScript.sections[0].text.includes('shipping lane')"), "script edits persist")

click("[data-action='send-back-script']")
wait_for("Boolean(document.querySelector('#script-form'))", "review can return to the Scriptwriter")
set_value(".script-section:nth-last-child(2) textarea", "The easier choice today can create the more dangerous crisis tomorrow.")
click("#script-form button[type='submit']")
wait_for("document.querySelectorAll('.score-ring').length === 4", "revised script receives a fresh review")

# Hash route and local project state survive a full browser refresh.
project_hash = evaluate("location.hash")
browser.command("Page.reload", {"ignoreCache": True})
wait_for("document.querySelectorAll('.score-ring').length === 4", "review survives a full browser refresh")
check(evaluate("location.hash") == project_hash, "refresh preserves the active workflow route")
check(evaluate("document.querySelector('#app').textContent.includes('CreatorPilot')"), "refresh restores the saved project")

click("[data-action='approve-production']")
wait_for("document.querySelectorAll('.scene-row').length === 8", "storyboard generates eight scenes")
if expect_api_storyboard:
    check(evaluate("JSON.parse(localStorage.getItem('creatorpilot:v1')).projects[0].storyboard[0].searchQuery.includes('licensed geopolitical')"), "real Storyboard metadata persists")
    check(evaluate("JSON.parse(localStorage.getItem('creatorpilot:v1')).projects[0].storyboard.at(-1).end === 60"), "real Storyboard timeline reaches the target duration")
capture("storyboard-1280")
check(evaluate("document.body.textContent.includes('Search query')"), "storyboard includes production metadata")
set_value("[data-project-setting='voice']", "Min — Clear explainer")
click("[data-project-setting='music']")
click("[data-action='render-video']")
wait_for("Boolean(document.querySelector('.final-player'))", "mock video render reaches final result", timeout=5)
check(evaluate("document.querySelector('[data-action=\"export-video\"]') !== null"), "export action is available")
evaluate("window.__exportDownload = null; HTMLAnchorElement.prototype.click = function () { window.__exportDownload = this.download; }")
click("[data-action='export-video']")
check(evaluate("window.__exportDownload.endsWith('-creatorpilot-package.json')"), "production package export is triggered")
check(evaluate("document.querySelector('.delivery-panel').textContent.includes('Min — Clear explainer')"), "voice selection carries into the final package")
check(evaluate("document.querySelector('.delivery-panel').textContent.includes('Off')"), "music setting carries into the final package")
check(evaluate("document.querySelector('.pipeline-completed:last-child') !== null"), "producer pipeline stage completes")

# Responsive and accessibility checks on the completed workflow.
for width, height, name in ((1280, 900, "desktop"), (768, 1024, "tablet"), (390, 844, "mobile")):
    browser.command("Emulation.setDeviceMetricsOverride", {
        "width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 600,
    })
    time.sleep(0.08)
    check(evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"{name} final result has no horizontal overflow")
    screenshot = browser.command("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
    (evidence / f"creatorpilot-{name}-{width}.png").write_bytes(base64.b64decode(screenshot["data"]))

browser.command("Emulation.clearDeviceMetricsOverride")
evaluate("location.hash = '#/dashboard'")
wait_for("document.querySelectorAll('.project-row').length >= 2", "completed project returns to dashboard")
browser.command("Emulation.setDeviceMetricsOverride", {
    "width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True,
})
time.sleep(0.08)
check(evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "mobile dashboard has no horizontal overflow")
browser.command("Emulation.clearDeviceMetricsOverride")

unnamed = evaluate(
    "Array.from(document.querySelectorAll('button,input,textarea,select,a'))"
    ".filter(el => {const r=el.getBoundingClientRect(); return r.width>0&&r.height>0})"
    ".filter(el => !(el.getAttribute('aria-label') || el.labels?.length || el.textContent.trim() || el.title))"
    ".map(el => el.outerHTML.slice(0,100))"
)
check(not unnamed, f"visible controls have accessible names ({unnamed})")

problem_events = []
for event in browser.events:
    method = event.get("method")
    params = event.get("params", {})
    if method == "Runtime.exceptionThrown":
        problem_events.append(params.get("exceptionDetails", {}).get("text", "runtime exception"))
    if method == "Log.entryAdded" and params.get("entry", {}).get("level") == "error":
        problem_events.append(params["entry"].get("text", "console error"))
check(not problem_events, f"browser console and runtime are clean ({problem_events})")

print("CreatorPilot browser workflow passed.")
