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
import { renderReview } from "../pages/review.mjs";
import { renderProduction } from "../pages/production.mjs";

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

test("Phase 3 mixed mode sends abstract analysis to the Scriptwriter without a transcript", async () => {
  const calls = [];
  const services = createServices(
    {
      services: { transcript: "mock", analysis: "mock", script: "api", review: "mock", storyboard: "mock", video: "mock" },
      apiBaseUrl: "http://127.0.0.1:8787",
    },
    async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      return { ok: true, json: async () => ({ data: {
        scriptId: "script_api_v1",
        title: "An API-generated script",
        version: 1,
        estimatedSeconds: 58,
        sections: [{ id: "hook", label: "Hook", range: "0–60s", text: "A complete original narration." }],
      } }) };
    },
  );
  const project = createProject({ id: "project-phase-3", topic: "A new topic", language: "English" });
  project.transcript = { transcriptId: "tr_private", text: "Raw reference wording must not be sent." };
  project.analysis = await analyzeReference(project);
  project.generatedScript = await services.generateScript(project);
  assert.equal(calls[0].url, "http://127.0.0.1:8787/api/scripts/generate");
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, "transcript"), false);
  assert.equal(calls[0].body.referenceAnalysis.analysisId, project.analysis.analysisId);
  assert.deepEqual(calls[0].body.revisionInstructions, []);
  assert.equal(project.generatedScript.scriptId, "script_api_v1");
});

test("Scriptwriter revision sends version lineage, instructions, and stable-ID preference", async () => {
  let call;
  const services = createServices(
    {
      services: { transcript: "mock", analysis: "mock", script: "api", review: "mock", storyboard: "mock", video: "mock" },
      apiBaseUrl: "http://127.0.0.1:8787",
    },
    async (url, options) => {
      call = { url, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ data: {
        scriptId: "script_api_v2",
        supersedesScriptId: "script_api_v1",
        title: "Revised script",
        version: 2,
        estimatedSeconds: 59,
        sections: [{ id: "hook", label: "Hook", range: "0–60s", text: "A revised original narration." }],
      } }) };
    },
  );
  const project = createProject({ id: "project-revision", topic: "A new topic", language: "English" });
  project.analysis = await analyzeReference(project);
  project.generatedScript = {
    scriptId: "script_api_v1",
    title: "First script",
    version: 1,
    estimatedSeconds: 58,
    sections: [{ id: "hook", label: "Hook", range: "0–60s", text: "The first narration." }],
  };
  const revised = await services.reviseScript(project, ["Use a more concrete conclusion."]);
  assert.equal(call.url, "http://127.0.0.1:8787/api/scripts/revise");
  assert.equal(call.body.currentScript.scriptId, "script_api_v1");
  assert.deepEqual(call.body.revisionInstructions, ["Use a more concrete conclusion."]);
  assert.equal(call.body.preserveSectionIds, true);
  assert.equal(Object.prototype.hasOwnProperty.call(call.body, "transcript"), false);
  assert.equal(revised.version, 2);
});

test("Phase 4 mixed mode sends the exact reference and script to the Reviewer", async () => {
  let call;
  const services = createServices(
    {
      services: { transcript: "mock", analysis: "mock", script: "mock", review: "api", storyboard: "mock", video: "mock" },
      apiBaseUrl: "http://127.0.0.1:8787",
    },
    async (url, options) => {
      call = { url, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ data: {
        reviewId: "review_api",
        scriptId: "script_api",
        status: "passed",
        overall: 91,
        originalityEstimate: 92,
        structureSimilarity: { score: 32, risk: "low", note: "Abstract mechanics only." },
        scores: { hook: 90, structure: 87, clarity: 94, duration: 96 },
        summary: "Distinct wording and subject expression.",
        overlaps: [],
        instructions: ["Verify factual claims."],
        disclaimer: "This similarity review is an originality estimate, not a copyright or legal determination.",
      } }) };
    },
  );
  const project = createProject({ id: "project-phase-4", topic: "A new topic", language: "English" });
  project.transcript = { transcriptId: "transcript_api", text: "The exact reference wording used for comparison." };
  project.analysis = await analyzeReference(project);
  project.generatedScript = {
    scriptId: "script_api",
    title: "A new script",
    version: 1,
    estimatedSeconds: 59,
    sections: [{ id: "hook", label: "Hook", range: "0–60s", text: "The exact generated narration." }],
  };
  const review = await services.reviewOriginality(project);
  assert.equal(call.url, "http://127.0.0.1:8787/api/scripts/review");
  assert.equal(call.body.referenceTranscript.text, project.transcript.text);
  assert.equal(call.body.referenceAnalysis.analysisId, project.analysis.analysisId);
  assert.equal(call.body.script.scriptId, project.generatedScript.scriptId);
  assert.equal(call.body.script.sections[0].text, "The exact generated narration.");
  assert.equal(review.reviewId, "review_api");
});

test("the review screen distinguishes medium and high overlap risks", () => {
  const project = createProject();
  project.originalityReview = {
    status: "failed",
    overall: 70,
    scores: { hook: 80, structure: 70, clarity: 90, duration: 95 },
    summary: "Revision is required.",
    overlaps: [
      { reference: "Reference one", generated: "Draft one", risk: "Medium", note: "Review this cadence." },
      { reference: "Reference two", generated: "Draft two", risk: "High", note: "Rewrite this phrase." },
    ],
    instructions: ["Rewrite the flagged phrase."],
    disclaimer: "This similarity review is an originality estimate, not a copyright or legal determination.",
  };
  const html = renderReview(project);
  assert.match(html, /class="risk-medium"/);
  assert.match(html, /class="risk-high"/);
  assert.doesNotMatch(html, /class="risk-low">Medium/);
});

test("Phase 5 mixed mode sends approval, duration, and constraints to Storyboard", async () => {
  let call;
  const services = createServices(
    {
      services: { transcript: "mock", analysis: "mock", script: "mock", review: "mock", storyboard: "api", video: "mock" },
      apiBaseUrl: "http://127.0.0.1:8787",
    },
    async (url, options) => {
      call = { url, body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ data: [{
        id: "scene-1",
        number: 1,
        start: 0,
        end: 60,
        duration: 60,
        narration: "Exact narration.",
        caption: "Exact evidence",
        visual: "A restrained vertical composition.",
        searchQuery: "licensed evidence vertical",
        transition: "Fade up",
      }] }) };
    },
  );
  const project = createProject({ id: "project-phase-5", duration: 60, format: "9:16" });
  project.generatedScript = {
    scriptId: "script-approved",
    title: "Approved script",
    version: 2,
    estimatedSeconds: 59,
    sections: [{ id: "hook", label: "Hook", range: "0–60s", text: "Exact narration." }],
  };
  project.originalityReview = { reviewId: "review-approved", scriptId: "script-approved", status: "passed" };
  const scenes = await services.generateStoryboard(project);
  assert.equal(call.url, "http://127.0.0.1:8787/api/storyboards/generate");
  assert.equal(call.body.approvedReviewId, "review-approved");
  assert.equal(call.body.script.scriptId, "script-approved");
  assert.equal(call.body.targetDurationSeconds, 60);
  assert.equal(call.body.sceneCount, 8);
  assert.match(call.body.visualConstraints[0], /licensed/);
  assert.equal(scenes[0].id, "scene-1");
});

test("the production board identifies the Storyboard Agent before rendering", () => {
  const project = createProject();
  project.originalityReview = { status: "passed" };
  const loading = renderProduction(project);
  assert.match(loading, /Storyboard Agent/);
  project.storyboard = [{
    id: "scene-1", number: 1, start: 0, end: 60, duration: 60,
    narration: "Narration", caption: "Caption", visual: "Visual", searchQuery: "Query", transition: "Fade up",
  }];
  const ready = renderProduction(project);
  assert.match(ready, /Storyboard Agent · Plan ready/);
});

test("analysis errors distinguish permanent configuration failures from retryable failures", () => {
  const permanent = errorNotice({ code: "LLM_NOT_CONFIGURED", message: "Configure the provider.", retryable: false }, "retry-analysis");
  assert.match(permanent, /not configured/);
  assert.doesNotMatch(permanent, />Retry</);
  const retryable = errorNotice({ code: "LLM_TIMEOUT", message: "Timed out.", retryable: true }, "retry-analysis");
  assert.match(retryable, /Script Analyst took too long/);
  assert.match(retryable, />Retry</);
});

test("analysis contract errors explain safe validation categories", () => {
  const notice = errorNotice({
    code: "INVALID_LLM_RESPONSE",
    message: "The response did not match the contract.",
    retryable: true,
    details: [{ field: "structure", reason: "duration_inconsistent" }],
  }, "retry-analysis");
  assert.match(notice, /section timeline did not match the reference duration/);
  assert.doesNotMatch(notice, /transcript text|API key/i);
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
