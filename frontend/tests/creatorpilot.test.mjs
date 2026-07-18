import assert from "assert";

import {
  PIPELINE_STEPS,
  createProject,
  createStore,
  parseRoute,
  referenceTitleFromTranscript,
  routeFor,
  updatePipeline,
  wordCount,
} from "../core.mjs";
import {
  analyzeReference,
  extractTranscript,
  generateScript,
  generateStoryboard,
  renderVideo,
  reviewOriginality,
} from "../mock-services.mjs";
import { createServices, getServiceConfig } from "../service-client.mjs";
import { errorNotice } from "../components.mjs";

globalThis.location = { search: "?fast=1" };

const tests = [];
function test(name, callback) { tests.push({ name, callback }); }

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("new projects use the complete waiting pipeline", () => {
  const project = createProject({ topic: "A new topic", referenceUrl: "https://youtu.be/example" });
  assert.equal(Object.keys(project.pipeline).length, PIPELINE_STEPS.length);
  assert.ok(Object.values(project.pipeline).every((step) => step.status === "waiting"));
  assert.equal(project.duration, 60);
  assert.equal(project.format, "9:16");
});

test("the local store adds and updates projects", () => {
  const store = createStore(memoryStorage());
  const project = createProject({ id: "project-test", topic: "Test production" });
  store.addProject(project);
  store.updateProject(project.id, { status: "analyzing" });
  assert.equal(store.getProject(project.id).status, "analyzing");
  assert.equal(store.getState().activeProjectId, project.id);
});

test("pipeline updates preserve every other agent state", () => {
  const project = createProject();
  const pipeline = updatePipeline(project, "analyst", "in_progress", "Mapping structure");
  assert.equal(pipeline.analyst.status, "in_progress");
  assert.equal(pipeline.writer.status, "waiting");
});

test("missing transcript metadata preserves the existing reference title", () => {
  assert.equal(referenceTitleFromTranscript({ title: null }, "Reference video"), "Reference video");
  assert.equal(referenceTitleFromTranscript({ title: "  Live reference  " }, "Reference video"), "Live reference");
});

test("hash routes round-trip project workspaces", () => {
  assert.equal(routeFor("review", "project-42"), "#/projects/project-42/review");
  assert.deepEqual(parseRoute("#/projects/project-42/review"), { name: "review", projectId: "project-42" });
});

test("the complete mock service chain returns a production package", async () => {
  const project = createProject({
    topic: "Why the United States cannot abandon Taiwan",
    referenceUrl: "https://youtube.com/watch?v=example",
    language: "English",
  });
  project.transcript = await extractTranscript(project);
  project.analysis = await analyzeReference(project);
  project.generatedScript = await generateScript(project);
  project.originalityReview = await reviewOriginality(project);
  project.storyboard = await generateStoryboard(project);
  const updates = [];
  project.render = await renderVideo(project, (progress) => updates.push(progress));
  assert.equal(project.analysis.structure.length, 6);
  assert.equal(project.generatedScript.sections.length, 7);
  assert.ok(wordCount(project.generatedScript) > 60);
  assert.equal(project.originalityReview.status, "passed");
  assert.equal(project.storyboard.length, 8);
  assert.equal(updates.length, 6);
  assert.equal(project.render.progress, 100);
  assert.equal(project.render.completed, true);
  assert.equal(project.analysis.safety.longSourceExcerptsIncluded, false);
  assert.ok(project.analysis.confidence > 0 && project.analysis.confidence <= 1);
});

test("mock services expose retryable named failures", async () => {
  globalThis.location.search = "?fast=1&fail=analyzeReference";
  await assert.rejects(analyzeReference(), /could not complete/);
  globalThis.location.search = "?fast=1";
});

test("service configuration defaults safely to mock mode", () => {
  assert.deepEqual(getServiceConfig(), {
    useMockServices: true,
    services: {
      transcript: "mock",
      analysis: "mock",
      script: "mock",
      review: "mock",
      storyboard: "mock",
      video: "mock",
    },
    apiBaseUrl: "",
    renderPollIntervalMs: 1500,
  });
});

test("API mode maps transcript extraction to the documented endpoint", async () => {
  const calls = [];
  const services = createServices(
    { useMockServices: false, apiBaseUrl: "https://api.example.test" },
    async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ data: { title: "Reference", text: "Transcript" } }) };
    },
  );
  const result = await services.extractTranscript(createProject({ id: "project-api", referenceUrl: "https://youtu.be/demo", language: "English" }));
  assert.equal(calls[0].url, "https://api.example.test/api/transcripts/extract");
  assert.equal(JSON.parse(calls[0].options.body).projectId, "project-api");
  assert.equal(result.text, "Transcript");
});

test("mixed mode calls only transcript through the API", async () => {
  const calls = [];
  const services = createServices(
    {
      services: { transcript: "api", analysis: "mock", script: "mock", review: "mock", storyboard: "mock", video: "mock" },
      apiBaseUrl: "http://127.0.0.1:8787",
    },
    async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ data: { source: "youtube_captions", title: "Live reference", text: "A real normalized transcript." } }) };
    },
  );
  const project = createProject({ id: "project-mixed", referenceUrl: "https://youtu.be/jNQXAC9IVRw", language: "English" });
  const transcript = await services.extractTranscript(project);
  project.transcript = transcript;
  const analysis = await services.analyzeReference(project);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "http://127.0.0.1:8787/api/transcripts/extract");
  assert.equal(transcript.source, "youtube_captions");
  assert.equal(analysis.structure.length, 6);
});

test("Phase 2 mixed mode uses API transcript and analysis while later agents stay mocked", async () => {
  const calls = [];
  const services = createServices(
    {
      services: { transcript: "api", analysis: "api", script: "mock", review: "mock", storyboard: "mock", video: "mock" },
      apiBaseUrl: "http://127.0.0.1:8787",
    },
    async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      if (url.endsWith("/api/transcripts/extract")) {
        return { ok: true, json: async () => ({ data: {
          transcriptId: "tr_live",
          source: "youtube_captions",
          title: null,
          text: "A normalized transcript with enough text for a real analysis request.",
          language: "en",
          wordCount: 11,
          estimatedDuration: 60,
          segments: [],
        } }) };
      }
      return { ok: true, json: async () => ({ data: {
        analysisId: "analysis_mixed",
        hookType: "Question",
        hookDuration: 4,
        targetAudience: "General audience",
        tone: "Confident",
        pacing: "Fast",
        retentionTechniques: ["Open loop"],
        callToAction: "Invite reflection",
        estimatedOriginalDuration: 60,
        structure: [{ label: "Hook", start: 0, end: 4, note: "Create curiosity" }, { label: "Body", start: 4, end: 60, note: "Resolve the question" }],
        safety: { longSourceExcerptsIncluded: false, maxQuotedWords: 0 },
      } }) };
    },
  );
  const project = createProject({ id: "project-phase-2", referenceUrl: "https://youtu.be/jNQXAC9IVRw", language: "Korean", topic: "A new topic" });
  project.transcript = await services.extractTranscript(project);
  project.analysis = await services.analyzeReference(project);
  project.generatedScript = await services.generateScript(project);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "http://127.0.0.1:8787/api/analysis/reference");
  assert.equal(calls[1].body.analysisLanguage, "Korean");
  assert.equal(project.generatedScript.version, 1);
});

test("analysis errors distinguish permanent configuration failures from retryable failures", () => {
  const permanent = errorNotice({ code: "LLM_NOT_CONFIGURED", message: "Configure the provider.", retryable: false }, "retry-analysis");
  assert.match(permanent, /not configured/);
  assert.doesNotMatch(permanent, />Retry</);
  const retryable = errorNotice({ code: "LLM_TIMEOUT", message: "Timed out.", retryable: true }, "retry-analysis");
  assert.match(retryable, /analysis took too long/);
  assert.match(retryable, />Retry</);
});

let failures = 0;
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
console.log(`\n${tests.length - failures}/${tests.length} tests passed`);
if (failures) process.exitCode = 1;
