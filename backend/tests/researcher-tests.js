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
    text: JSON.stringify({
      summary: "Libraries support several measurable community functions, though local results vary by program design.",
      verdictStatus: "partially_supported",
      recommendedFrame: "Judge libraries by the opportunities they make reachable.",
      facts: [1, 2, 3].map((number) => ({ claim: `Supported claim ${number}`, explanation: `A concise sourced explanation ${number}.`, confidence: number === 3 ? "medium" : "high", sourceUrls: [`https://source${number}.example/report`] })),
      counterpoint: { claim: "Local outcomes are not uniform.", explanation: "Program design and community conditions affect measured results.", sourceUrls: ["https://source3.example/report"] },
      ...(overrides.body || {}),
    }),
    sources: [1, 2, 3].map((number) => ({ title: `Primary source ${number}`, url: `https://source${number}.example/report` })),
    ...overrides,
  };
}

class FakeProvider {
  constructor(result = providerResult()) { this.result = result; this.calls = []; }
  async research(input) { this.calls.push(input); if (this.result instanceof Error) throw this.result; return this.result; }
}

test("gives web research a five-minute default deadline", () => {
  const researcher = new Researcher({ environment: { LLM_API_BASE_URL: "https://api.openai.com/v1", LLM_API_KEY: "test-key", LLM_MODEL: "test-model", LLM_TIMEOUT_MS: "50000" } });
  assert.equal(researcher.provider.timeoutMs, 300000);
});

test("honors an explicit Research Agent deadline", () => {
  const researcher = new Researcher({ environment: { LLM_API_BASE_URL: "https://api.openai.com/v1", LLM_API_KEY: "test-key", LLM_MODEL: "test-model", RESEARCH_LLM_TIMEOUT_MS: "240000" } });
  assert.equal(researcher.provider.timeoutMs, 240000);
});

test("uses one shared Research model even when Deep role settings exist", () => {
  const researcher = new Researcher({
    environment: {
      LLM_PROVIDER: "openrouter",
      LLM_API_BASE_URL: "https://openrouter.ai/api/v1",
      LLM_API_KEY: "shared-openrouter-key",
      LLM_MODEL: "vendor/default-model",
      RESEARCH_A_LLM_MODEL: "vendor-a/evidence-model",
      RESEARCH_B_LLM_MODEL: "vendor-b/narrative-model",
      RESEARCH_JUDGE_LLM_MODEL: "vendor-c/judge-model",
    },
  });
  assert.equal(researcher.provider.apiKey, "shared-openrouter-key");
  assert.equal(researcher.provider.apiBaseUrl, "https://openrouter.ai/api/v1");
  assert.equal(researcher.provider.model, "vendor/default-model");
});

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
  assert.deepEqual(result.facts[0].sourceIds, ["source_1"]); assert.equal(result.verdict.status, "partially_supported"); assert.equal(result.narrativeCase.mode, "reframe"); assert.deepEqual(result.narrativeCase.supportFactIds, ["fact_1", "fact_2", "fact_3"]); assert.equal(result.comparisons.length, 0); assert.deepEqual(result.storyFindings[0].factIds, ["fact_1"]); assert.equal(result.safety.providerVerifiedSources, true); assert.equal(provider.calls.length, 1);
});

test("deep projects still use one lightweight Research call", async () => {
  const primary = new FakeProvider();
  const researcher = new Researcher({ provider: primary });
  const result = await researcher.research(validRequest({ analysisMode: "deep" }));
  assert.equal(result.ensemble, undefined);
  assert.equal(primary.calls.length, 1);
});

test("rejects an unsupported research analysis mode", async () => {
  await assert.rejects(new Researcher({ provider: new FakeProvider() }).research(validRequest({ analysisMode: "maximum" })), (error) => error.code === "INVALID_RESEARCH_BRIEF" && error.details[0].field === "analysisMode");
});

test("drops a fact URL whose URL was not returned by the provider", async () => {
  const result = providerResult(); const body = JSON.parse(result.text); body.facts[0].sourceUrls = ["https://invented.example/report"]; result.text = JSON.stringify(body);
  const normalized = await new Researcher({ provider: new FakeProvider(result) }).research(validRequest());
  assert.deepEqual(normalized.facts[0].sourceIds, []);
  assert.equal(normalized.facts.length, 3);
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

test("builds an OpenRouter Responses request with the server web search tool", async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, headers: options.headers, body: JSON.parse(options.body) };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: "{}",
            annotations: [{ type: "url_citation", url: "https://source.example/report", title: "Source" }],
          }],
        }],
      }),
    };
  };
  const provider = new OpenAIWebResearchProvider({
    providerName: "openrouter",
    apiBaseUrl: "https://openrouter.ai/api/v1",
    apiKey: "test-key",
    model: "vendor/research-model",
    httpReferer: "https://creatorpilot.example",
    appTitle: "CreatorPilot",
    fetchImpl,
    AbortControllerImpl: AbortController,
  });
  await provider.research({ instructions: "Research", input: "Topic", schema: { type: "object" } });
  assert.equal(captured.url, "https://openrouter.ai/api/v1/responses");
  assert.deepEqual(captured.body.tools, [{
    type: "openrouter:web_search",
    parameters: { engine: "exa", search_context_size: "medium", max_results: 5, max_total_results: 10 },
  }]);
  assert.equal(captured.body.max_tool_calls, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(captured.body, "include"), false);
  assert.equal(captured.headers["HTTP-Referer"], "https://creatorpilot.example");
  assert.equal(captured.headers["X-OpenRouter-Title"], "CreatorPilot");
});

test("collects both consulted and cited HTTPS sources", () => {
  const result = responseParts({ output: [{ type: "web_search_call", action: { sources: [{ url: "https://one.example/a", title: "One" }, { url: "http://unsafe.example", title: "Unsafe" }] } }, { type: "openrouter:web_search", action: { sources: [{ url: "https://openrouter.example/report", title: "OpenRouter" }] } }, { type: "message", content: [{ type: "output_text", text: "result", annotations: [{ type: "url_citation", url: "https://two.example/b", title: "Two" }] }] }] });
  assert.equal(result.text, "result"); assert.deepEqual(result.sources.map((source) => source.url), ["https://one.example/a", "https://openrouter.example/report", "https://two.example/b"]);
});

test("collects OpenRouter nested citation annotations", () => {
  const result = responseParts({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: "result",
        annotations: [{
          type: "url_citation",
          url_citation: { url: "https://nested.example/report", title: "Nested source" },
        }],
      }],
    }],
  });
  assert.deepEqual(result.sources, [{ url: "https://nested.example/report", title: "Nested source" }]);
});

test("uses the final Responses message as the structured research result", () => {
  const result = responseParts({
    output: [
      { type: "message", content: [{ type: "output_text", text: "Searching current sources.", annotations: [] }] },
      { type: "message", content: [{ type: "output_text", text: "{\"summary\":\"final\"}", annotations: [{ type: "url_citation", url: "https://final.example/report", title: "Final" }] }] },
    ],
  });
  assert.equal(result.text, "{\"summary\":\"final\"}");
  assert.deepEqual(result.sources, [{ url: "https://final.example/report", title: "Final" }]);
});

test("prefers a structured JSON message over trailing provider commentary", () => {
  const result = responseParts({
    output: [
      { type: "message", content: [{ type: "output_text", text: "{\"summary\":\"structured\"}", annotations: [] }] },
      { type: "message", content: [{ type: "output_text", text: "Request completed.", annotations: [] }] },
    ],
  });
  assert.equal(result.text, "{\"summary\":\"structured\"}");
});

let failures = 0;
(async () => { for (const { name, callback } of tests) { try { await callback(); console.log(`✓ ${name}`); } catch (error) { failures += 1; console.error(`✗ ${name}`); console.error(error); } } console.log(`\n${tests.length - failures}/${tests.length} researcher tests passed`); if (failures) process.exitCode = 1; })();
