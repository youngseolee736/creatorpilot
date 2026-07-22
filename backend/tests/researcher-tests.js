const assert = require("assert");
const http = require("http");
const AbortController = require("abort-controller");
const { Researcher } = require("../src/agents/researcher/researcher");
const { OpenAIWebResearchProvider, responseParts } = require("../src/services/research/openai-web-research-provider");
const { createApp } = require("../src/app");

const tests = [];
function test(name, callback) { tests.push({ name, callback }); }

function validRequest(overrides = {}) {
  return {
    projectId: "project-research-test",
    creativeBrief: { topic: "How public libraries strengthen neighborhoods", angle: "Explain measurable civic effects without nostalgia.", targetAudience: "Adults interested in local policy", viewerGoal: "Understand why libraries matter beyond books", desiredTakeaway: "Libraries are practical civic infrastructure", tone: "Clear, practical, evidence-led", language: "English", mustInclude: [], mustAvoid: ["Partisan claims"], callToAction: "Invite viewers to visit their local library" },
    referenceBlueprint: { analysisId: "analysis_research_test", hookType: "Expectation reversal", hookPurpose: "Challenge a narrow assumption", tone: "Optimistic", pacing: "Fast opening, measured evidence, concise close", ending: "Resolve with broader civic stakes", retentionTechniques: ["Expectation reversal", "Concrete mechanism"], structure: [{ label: "Hook", start: 0, end: 5, purpose: "Create curiosity" }, { label: "Context", start: 5, end: 16, purpose: "Set up the issue" }, { label: "Development", start: 16, end: 48, purpose: "Explain evidence" }, { label: "Conclusion (Ending)", start: 48, end: 60, purpose: "Resolve the promise" }] },
    ...overrides,
  };
}

function providerResult(overrides = {}) {
  return {
    text: JSON.stringify({ summary: "Libraries support several measurable community functions.", facts: [1, 2, 3].map((number) => ({ claim: `Supported claim ${number}`, explanation: `A concise sourced explanation ${number}.`, confidence: number === 3 ? "medium" : "high", sourceUrls: [`https://source${number}.example/report`] })), openQuestions: ["Local outcomes vary by program design."], ...(overrides.body || {}) }),
    sources: [1, 2, 3].map((number) => ({ title: `Primary source ${number}`, url: `https://source${number}.example/report` })),
    ...overrides,
  };
}

class FakeProvider {
  constructor(result = providerResult()) { this.result = result; this.calls = []; }
  async research(input) { this.calls.push(input); if (this.result instanceof Error) throw this.result; return this.result; }
}

async function request(app, path, body) {
  const server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
  const payload = JSON.stringify(body);
  try { return await new Promise((resolve, reject) => { const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path, method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } }, (res) => { let text = ""; res.setEncoding("utf8"); res.on("data", (chunk) => { text += chunk; }); res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(text) })); }); req.on("error", reject); req.write(payload); req.end(); }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("creates a provider-grounded Fact Pack", async () => {
  const provider = new FakeProvider(); const researcher = new Researcher({ provider });
  const result = await researcher.research(validRequest());
  assert.match(result.researchId, /^research_/); assert.equal(result.facts.length, 3); assert.equal(result.sources.length, 3);
  assert.deepEqual(result.facts[0].sourceIds, ["source_1"]); assert.equal(result.safety.providerVerifiedSources, true); assert.equal(provider.calls.length, 1);
});

test("rejects a fact whose URL was not returned by the provider", async () => {
  const result = providerResult(); const body = JSON.parse(result.text); body.facts[0].sourceUrls = ["https://invented.example/report"]; result.text = JSON.stringify(body);
  await assert.rejects(new Researcher({ provider: new FakeProvider(result) }).research(validRequest()), (error) => error.code === "INVALID_RESEARCH_RESPONSE" && error.details[0].reason === "not_in_provider_sources");
});

test("rejects raw transcript content at the Research Agent boundary", async () => {
  const result = await request(createApp({ researcher: new Researcher({ provider: new FakeProvider() }) }), "/api/research/topic", validRequest({ transcript: { text: "Reference text" } }));
  assert.equal(result.status, 400); assert.equal(result.body.error.code, "INVALID_RESEARCH_BRIEF"); assert.equal(result.body.error.details[0].reason, "prohibited");
});

test("exposes the topic research route", async () => {
  const result = await request(createApp({ researcher: new Researcher({ provider: new FakeProvider() }) }), "/api/research/topic", validRequest());
  assert.equal(result.status, 201); assert.equal(result.body.data.facts.length, 3);
});

test("builds a Responses API web_search request with structured output and sources", async () => {
  let captured;
  const fetchImpl = async (url, options) => { captured = { url, body: JSON.parse(options.body) }; return { ok: true, status: 200, text: async () => JSON.stringify({ output: [{ type: "web_search_call", action: { sources: [{ url: "https://source.example/report", title: "Source" }] } }, { type: "message", content: [{ type: "output_text", text: "{}", annotations: [] }] }] }) }; };
  const provider = new OpenAIWebResearchProvider({ apiBaseUrl: "https://api.openai.com/v1", apiKey: "test-key", model: "test-model", fetchImpl, AbortControllerImpl: AbortController });
  await provider.research({ instructions: "Research", input: "Topic", schema: { type: "object" } });
  assert.equal(captured.url, "https://api.openai.com/v1/responses"); assert.deepEqual(captured.body.tools, [{ type: "web_search", search_context_size: "medium" }]); assert.deepEqual(captured.body.include, ["web_search_call.action.sources"]); assert.equal(captured.body.text.format.type, "json_schema");
});

test("collects both consulted and cited HTTPS sources", () => {
  const result = responseParts({ output: [{ type: "web_search_call", action: { sources: [{ url: "https://one.example/a", title: "One" }, { url: "http://unsafe.example", title: "Unsafe" }] } }, { type: "message", content: [{ type: "output_text", text: "result", annotations: [{ type: "url_citation", url: "https://two.example/b", title: "Two" }] }] }] });
  assert.equal(result.text, "result"); assert.deepEqual(result.sources.map((source) => source.url), ["https://one.example/a", "https://two.example/b"]);
});

let failures = 0;
(async () => { for (const { name, callback } of tests) { try { await callback(); console.log(`✓ ${name}`); } catch (error) { failures += 1; console.error(`✗ ${name}`); console.error(error); } } console.log(`\n${tests.length - failures}/${tests.length} researcher tests passed`); if (failures) process.exitCode = 1; })();

