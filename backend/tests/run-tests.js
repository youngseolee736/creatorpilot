const assert = require("assert");
const http = require("http");
const AbortController = require("abort-controller");
const { createApp } = require("../src/app");
const { TranscriptService } = require("../src/services/transcript-service");
const { extractYouTubeVideo } = require("../src/utils/youtube-url");

const tests = [];
function test(name, callback) { tests.push({ name, callback }); }

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
  };
}

function serviceWith(fetchImpl, timeoutMs = 50) {
  return new TranscriptService({
    apiUrl: "https://provider.example/transcript",
    fetchImpl,
    timeoutMs,
    AbortControllerImpl: AbortController,
  });
}

async function request(app, path, body, headers = {}) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const payload = body == null ? null : JSON.stringify(body);

  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port: server.address().port,
        path,
        method: body == null ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
      });
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const validRequest = {
  projectId: "project-test",
  youtubeUrl: "https://youtu.be/jNQXAC9IVRw",
  targetLanguage: "English",
};

test("reports backend health", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})) });
  const result = await request(app, "/api/health", null);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok", service: "creatorpilot-backend" });
});

test("accepts supported YouTube URL formats and preserves the video ID", () => {
  assert.deepEqual(extractYouTubeVideo("https://www.youtube.com/watch?v=jNQXAC9IVRw"), {
    videoId: "jNQXAC9IVRw",
    canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  });
  assert.equal(extractYouTubeVideo("https://youtube.com/shorts/jNQXAC9IVRw").videoId, "jNQXAC9IVRw");
});

test("returns 400 when the YouTube URL is missing", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})) });
  const result = await request(app, "/api/transcripts/extract", { projectId: "project-test", targetLanguage: "English" });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_YOUTUBE_URL");
  assert.equal(result.body.error.retryable, false);
});

test("returns 400 for an unsupported URL", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})) });
  const result = await request(app, "/api/transcripts/extract", { ...validRequest, youtubeUrl: "https://example.com/watch?v=jNQXAC9IVRw" });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_YOUTUBE_URL");
});

test("maps transcript unavailable to a user-safe 404", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(404, { detail: "No transcript" })) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, "TRANSCRIPT_UNAVAILABLE");
  assert.equal(result.body.error.retryable, false);
});

test("maps provider rate limiting to 429 even when the error body is not JSON", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(429, "Too Many Requests")) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 429);
  assert.equal(result.body.error.code, "PROVIDER_RATE_LIMITED");
  assert.equal(result.body.error.retryable, true);
});

test("aborts a slow provider and returns 504", async () => {
  const fetchImpl = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
  const app = createApp({ transcriptService: serviceWith(fetchImpl, 5) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 504);
  assert.equal(result.body.error.code, "TRANSCRIPT_TIMEOUT");
  assert.equal(result.body.error.retryable, true);
});

test("rejects malformed upstream JSON with 502", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, "not-json")) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "TRANSCRIPT_PROVIDER_ERROR");
});

test("normalizes a successful provider transcript into the CreatorPilot contract", async () => {
  let providerRequest;
  const fetchImpl = async (url, options) => {
    providerRequest = { url, options };
    return response(200, {
      status: "success",
      title: "Me at the zoo",
      language: "en",
      transcript: [
        { start: 0, duration: 2.4, text: "All right, so here we are." },
        { start: 2.4, duration: 3.6, text: "The cool thing about these elephants is their trunks." },
      ],
    });
  };
  const app = createApp({ transcriptService: serviceWith(fetchImpl) });
  const result = await request(app, "/api/transcripts/extract", validRequest, { Origin: "http://127.0.0.1:4173" });
  assert.equal(result.status, 200);
  assert.match(result.body.requestId, /^req_/);
  assert.deepEqual(result.body.data, {
    transcriptId: "tr_jNQXAC9IVRw",
    source: "youtube_captions",
    title: "Me at the zoo",
    text: "All right, so here we are. The cool thing about these elephants is their trunks.",
    language: "en",
    wordCount: 15,
    estimatedDuration: 6,
    segments: [
      { start: 0, end: 2.4, text: "All right, so here we are." },
      { start: 2.4, end: 6, text: "The cool thing about these elephants is their trunks." },
    ],
  });
  assert.equal(providerRequest.url, "https://provider.example/transcript");
  assert.deepEqual(JSON.parse(providerRequest.options.body), { url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" });
  assert.equal(result.headers["access-control-allow-origin"], "http://127.0.0.1:4173");
});

test("rejects a browser origin outside the configured frontend", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})), frontendOrigin: "http://127.0.0.1:4173" });
  const result = await request(app, "/api/transcripts/extract", validRequest, { Origin: "https://untrusted.example" });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "ORIGIN_NOT_ALLOWED");
});

let failures = 0;
(async () => {
  for (const { name, callback } of tests) {
    try {
      await callback();
      console.log(`✓ ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`✗ ${name}`);
      console.error(error);
    }
  }
  console.log(`\n${tests.length - failures}/${tests.length} backend tests passed`);
  if (failures) process.exitCode = 1;
})();
