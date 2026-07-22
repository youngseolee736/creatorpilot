import assert from "assert";

import {
  PIPELINE_STEPS,
  createProject,
  createStore,
  parseRoute,
  referenceBlueprintFromAnalysis,
  referenceTitleFromTranscript,
  routeFor,
  updatePipeline,
  wordCount,
  youtubeVideoId,
} from "../core.mjs";
import {
  analyzeReference,
  extractTranscript,
  generateScript,
  generateStoryboard,
  renderVideo,
  researchTopic,
  reviewOriginality,
  synthesizeReferences,
} from "../mock-services.mjs";
import { createServices, getServiceConfig } from "../service-client.mjs";
import { errorNotice, pipeline } from "../components.mjs";
import { renderDashboard } from "../pages/dashboard.mjs";
import { renderAnalysis } from "../pages/analysis.mjs";
import { renderReview } from "../pages/review.mjs";
import { renderProduction } from "../pages/production.mjs";
import { renderResearch } from "../pages/research.mjs";
import { renderScriptEditor } from "../pages/script-editor.mjs";
import { renderNewProject } from "../pages/new-project.mjs";

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

test("new production intake shows three required and two optional references", () => {
  const html = renderNewProject();
  assert.equal((html.match(/name="referenceUrl[1-5]"/g) || []).length, 5);
  assert.equal((html.match(/<span class="requirement-label">Required<\/span>/g) || []).length, 3);
  assert.equal((html.match(/<span class="requirement-label">Optional<\/span>/g) || []).length, 2);
  assert.match(html, /3 required · up to 5 total/);
  assert.match(html, /Deep analysis/);
  assert.match(html, /Two independent candidates \+ final Judge/);
});

test("project state preserves three to five independent references", () => {
  const project = createProject({
    topic: "A new topic",
    referenceUrl1: "https://youtu.be/one",
    referenceUrl2: "https://youtu.be/two",
    referenceUrl3: "https://youtu.be/three",
    referenceUrl4: "https://youtu.be/four",
  });
  assert.equal(project.references.length, 4);
  assert.deepEqual(project.references.map((reference) => reference.required), [true, true, true, false]);
  assert.equal(project.referenceUrl, "https://youtu.be/one");
});

test("deep analysis selection persists with the project", () => {
  const project = createProject({ topic: "A new topic", analysisDepth: "deep" });
  assert.equal(project.analysisDepth, "deep");
  assert.equal(createProject({ topic: "A new topic" }).analysisDepth, "standard");
});

test("YouTube references are compared by video identity", () => {
  assert.equal(youtubeVideoId("https://youtu.be/abc123?t=4"), "abc123");
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=abc123&feature=share"), "abc123");
  assert.equal(youtubeVideoId("https://example.com/watch?v=abc123"), null);
});

test("mock synthesis combines three independent analyses", async () => {
  const project = createProject({
    id: "project-synthesis",
    topic: "A new topic",
    language: "English",
    referenceUrl1: "https://youtu.be/one",
    referenceUrl2: "https://youtu.be/two",
    referenceUrl3: "https://youtu.be/three",
  });
  for (const reference of project.references) {
    reference.transcript = await extractTranscript(project, reference);
    reference.analysis = await analyzeReference(project, reference);
  }
  const synthesis = await synthesizeReferences(project);
  assert.equal(synthesis.referenceCount, 3);
  assert.equal(synthesis.sourceAnalysisIds.length, 3);
  assert.match(synthesis.summary, /3 references/);
});

test("deep mock synthesis exposes a concise model comparison", async () => {
  const project = createProject({ id: "project-deep", topic: "A new topic", language: "English", analysisDepth: "deep" });
  project.references = [1, 2, 3].map((position) => ({ referenceId: `reference-${position}`, analysis: { analysisId: `analysis-${position}`, hookType: "Question" } }));
  const synthesis = await synthesizeReferences(project);
  project.analysis = synthesis;
  const html = renderAnalysis(project);
  assert.equal(synthesis.ensemble.candidates.length, 2);
  assert.match(html, /How the models compared/);
  assert.match(html, /Final Judge/);
  assert.match(html, /Combined decision/);
});

test("deep mode continues through Research and Scriptwriter comparisons", async () => {
  const project = createProject({ id: "project-deep-pipeline", topic: "Why a surprising contender can be the best", language: "English", analysisDepth: "deep" });
  project.research = await researchTopic(project);
  project.generatedScript = await generateScript(project);
  const researchHtml = renderResearch(project);
  const scriptHtml = renderScriptEditor(project);
  assert.equal(project.research.ensemble.candidates.length, 2);
  assert.equal(project.generatedScript.ensemble.candidates.length, 2);
  assert.match(researchHtml, /How the research models compared/);
  assert.match(researchHtml, /Research Judge/);
  assert.match(scriptHtml, /How the writing models compared/);
  assert.match(scriptHtml, /Writing Judge/);
});

test("Korean target language localizes generated mock content", async () => {
  const project = createProject({ id: "project-korean", topic: "손흥민이 최고의 선수인 이유", language: "Korean", referenceUrl: "https://youtu.be/example" });
  project.analysis = await analyzeReference(project);
  project.research = await researchTopic(project);
  project.generatedScript = await generateScript(project);
  project.originalityReview = await reviewOriginality(project);
  assert.match(project.analysis.summary, /예상|근거/);
  assert.match(project.research.summary, /근거|비교/);
  assert.match(project.generatedScript.sections[0].text, /최고|기준/);
  assert.match(project.originalityReview.summary, /초안|참고/);
});

test("the local store adds and updates projects", () => {
  const store = createStore(memoryStorage());
  const project = createProject({ id: "project-test", topic: "Test production" });
  store.addProject(project);
  store.updateProject(project.id, { status: "analyzing" });
  assert.equal(store.getProject(project.id).status, "analyzing");
  assert.equal(store.getState().activeProjectId, project.id);
});

test("the local store deletes a single project", () => {
  const store = createStore(memoryStorage());
  const keep = createProject({ id: "project-keep", topic: "Keep this" });
  const drop = createProject({ id: "project-drop", topic: "Drop this" });
  store.addProject(keep);
  store.addProject(drop);
  store.deleteProject(drop.id);
  assert.equal(store.getProject(drop.id), null);
  assert.equal(store.getProject(keep.id).topic, "Keep this");
  assert.equal(store.getState().activeProjectId, null);
});

test("the dashboard offers per-project deletion", () => {
  const store = createStore(memoryStorage());
  store.addProject(createProject({ id: "project-del", topic: "Delete me" }));
  const html = renderDashboard(store.getState());
  assert.match(html, /data-action="delete-project"/);
  assert.match(html, /data-project-id="project-del"/);
});

test("pipeline updates preserve every other agent state", () => {
  const project = createProject();
  const pipeline = updatePipeline(project, "analyst", "in_progress", "Mapping structure");
  assert.equal(pipeline.analyst.status, "in_progress");
  assert.equal(pipeline.writer.status, "waiting");
});

test("the workspace pipeline links every available stage and disables future work", () => {
  const project = createProject({ id: "project-pipeline-nav" });
  project.analysis = { ready: true };
  let html = pipeline(project, { currentRoute: "research" });
  assert.match(html, /href="#\/projects\/project-pipeline-nav\/analysis"/);
  assert.match(html, /href="#\/projects\/project-pipeline-nav\/research"/);
  assert.match(html, /aria-disabled="true" title="Complete the previous stage first">.*Scriptwriter/s);
  project.research = { ready: true };
  project.generatedScript = { ready: true };
  project.originalityReview = { ready: true, status: "passed" };
  html = pipeline(project, { currentRoute: "review" });
  assert.match(html, /href="#\/projects\/project-pipeline-nav\/script"/);
  assert.match(html, /href="#\/projects\/project-pipeline-nav\/review"/);
  assert.match(html, /href="#\/projects\/project-pipeline-nav\/production"/);
  assert.match(html, /pipeline-step pipeline-waiting is-current/);
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
    topic: "Why procrastination is not laziness",
    referenceUrl: "https://youtube.com/watch?v=example",
    language: "English",
  });
  project.transcript = await extractTranscript(project);
  project.analysis = await analyzeReference(project);
  project.referenceBlueprint = referenceBlueprintFromAnalysis(project.analysis);
  project.research = await researchTopic(project);
  project.generatedScript = await generateScript(project);
  project.originalityReview = await reviewOriginality(project);
  project.storyboard = await generateStoryboard(project);
  const updates = [];
  project.render = await renderVideo(project, (progress) => updates.push(progress));
  assert.equal(project.analysis.structure.length, 6);
  assert.equal(project.research.facts.length, 3);
  assert.equal(project.generatedScript.sections.length, 7);
  assert.equal(project.generatedScript.claim, project.topic);
  assert.deepEqual(project.generatedScript.usedFactIds, ["fact_1", "fact_2", "fact_3"]);
  assert.ok(wordCount(project.generatedScript) > 60);
  assert.equal(project.originalityReview.status, "passed");
  assert.equal(project.storyboard.length, 8);
  assert.equal(updates.length, 6);
  assert.equal(project.render.progress, 100);
  assert.equal(project.render.completed, true);
  assert.equal(project.analysis.safety.longSourceExcerptsIncluded, false);
  assert.ok(project.analysis.confidence > 0 && project.analysis.confidence <= 1);
  assert.match(project.referenceBlueprint.narrativeEngine, /system-level possibility/);
  assert.match(project.referenceBlueprint.informationPattern, /Assumption/);
});

test("the writing workspace keeps the claim and research evidence visible", async () => {
  const project = createProject({ id: "project-writing-ui", topic: "Why Son Heungmin is better than Messi", language: "English" });
  project.research = await researchTopic(project);
  project.generatedScript = await generateScript(project);
  const html = renderScriptEditor(project);
  assert.match(html, /Claim lock/);
  assert.match(html, /Why Son Heungmin is better than Messi/);
  assert.match(html, /Narrative case/);
  assert.match(html, /3 research findings used/);
  assert.match(html, /Fact 1/);
  assert.match(html, /Paragraph 01/);
  assert.match(html, /Read and edit one paragraph at a time/);
  assert.match(html, /script-paragraph/);
  assert.match(html, /Back to research/);
  assert.match(html, /#\/projects\/project-writing-ui\/research/);
});

test("every agent error screen keeps its previous-stage navigation", () => {
  const project = createProject({ id: "project-back-navigation", topic: "A claim" });
  project.error = { code: "LLM_TIMEOUT", message: "Timed out", retryable: true };
  assert.match(renderAnalysis(project), /href="#\/dashboard"[^>]*>← Back to projects/);
  assert.match(renderResearch(project), /href="#\/projects\/project-back-navigation\/analysis"[^>]*>← Back to analysis/);
  assert.match(renderScriptEditor(project), /href="#\/projects\/project-back-navigation\/research"[^>]*>← Back to research/);
  assert.match(renderReview(project), /href="#\/projects\/project-back-navigation\/script"[^>]*>← Back to Scriptwriter/);
  assert.match(renderProduction(project), /href="#\/projects\/project-back-navigation\/review"[^>]*>← Back to review/);
});

test("story analysis presents simple storytelling logic without a timeline", async () => {
  const project = createProject({ id: "project-dna-ui", topic: "A new topic", language: "English" });
  project.transcript = await extractTranscript(project);
  project.analysis = await analyzeReference(project);
  const html = renderAnalysis(project);
  assert.match(html, /The story behind the video/);
  assert.match(html, /Story in one line/);
  assert.match(html, /Three story decisions/);
  assert.match(html, /Opening/);
  assert.match(html, /Build/);
  assert.match(html, /Payoff/);
  assert.equal((html.match(/For your topic/g) || []).length, 3);
  assert.match(html, /A new topic/);
  assert.match(html, /Use this for your script/);
  assert.match(html, /Expectation reversal/);
  assert.doesNotMatch(html, /Retention map|Emotional Arc|Story structure|structure-timeline/);
  assert.match(html, /<details><summary>View mock transcript<\/summary>/);
});

test("story analysis does not crash on an incomplete saved analysis", () => {
  const project = createProject({ id: "project-incomplete-analysis", topic: "A topic", language: "English" });
  project.transcript = { source: "youtube_captions", text: "Saved transcript content." };
  project.analysis = { summary: "An incomplete saved result." };
  const html = renderAnalysis(project);
  assert.match(html, /The story behind the video/);
  assert.match(html, /Use this for your script/);
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
      research: "mock",
      script: "mock",
      review: "mock",
      storyboard: "mock",
      video: "mock",
    },
    apiBaseUrl: "",
    renderPollIntervalMs: 1500,
    renderPollLimit: 240,
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

test("Research API sends only the tailored brief and compact blueprint", async () => {
  let call;
  const services = createServices({ services: { research: "api" }, apiBaseUrl: "https://api.example.test" }, async (url, options) => {
    call = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ data: { researchId: "research_api", facts: [], sources: [], openQuestions: [] } }) };
  });
  const project = createProject({ id: "project-research-api", topic: "A tailored topic", language: "English" });
  project.analysis = await analyzeReference(project);
  project.referenceBlueprint = referenceBlueprintFromAnalysis(project.analysis);
  await services.researchTopic(project);
  assert.equal(call.url, "https://api.example.test/api/research/topic");
  assert.equal(call.body.creativeBrief.topic, "A tailored topic");
  assert.equal(call.body.referenceBlueprint.structure[0].label, "Hook");
  assert.equal(Object.prototype.hasOwnProperty.call(call.body, "transcript"), false);
});

test("Research screen shows a verdict, fair comparison, story findings, and clickable citations", async () => {
  const project = createProject({ id: "project-research-ui", topic: "A tailored topic", language: "English" });
  project.analysis = await analyzeReference(project);
  project.referenceBlueprint = referenceBlueprintFromAnalysis(project.analysis);
  project.research = await researchTopic(project);
  const html = renderResearch(project);
  assert.match(html, /What the evidence says/);
  assert.match(html, /Research verdict/);
  assert.match(html, /Best way to prove the claim/);
  assert.match(html, /Define greatness by transformative impact/);
  assert.match(html, /data-action="rerun-research"/);
  assert.match(html, /A fair comparison/);
  assert.match(html, /How they compare/);
  assert.match(html, /Where the claim gets weaker/);
  assert.match(html, /How to use it in the story/);
  assert.match(html, /href="#\/projects\/project-research-ui\/analysis"/);
  assert.match(html, /Back to analysis/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Not a factual guarantee/);
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
  assert.equal(calls[1].body.targetTopic, project.topic);
  assert.equal(project.generatedScript.version, 1);
});

test("Deep analysis API request includes the selected ensemble mode", async () => {
  let call;
  const services = createServices({ services: { analysis: "api" }, apiBaseUrl: "https://api.example.test" }, async (url, options) => {
    call = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ data: { analysisId: "synthesis-api" } }) };
  });
  const project = createProject({ id: "project-deep-api", topic: "새로운 주제", language: "Korean", analysisDepth: "deep" });
  project.references = [1, 2, 3].map((position) => ({ referenceId: `reference-${position}`, title: `Reference ${position}`, analysis: { analysisId: `analysis-${position}` } }));
  await services.synthesizeReferences(project);
  assert.equal(call.url, "https://api.example.test/api/analysis/synthesize");
  assert.equal(call.body.analysisMode, "deep");
  assert.equal(call.body.analysisLanguage, "Korean");
  assert.equal(call.body.analyses.length, 3);
});

test("Deep analysis mode is sent to Research and Scriptwriter APIs", async () => {
  const calls = [];
  const services = createServices({ services: { research: "api", script: "api" }, apiBaseUrl: "https://api.example.test" }, async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ data: {} }) };
  });
  const project = createProject({ id: "project-deep-agents", topic: "A new topic", language: "English", analysisDepth: "deep" });
  project.referenceBlueprint = {};
  project.research = {};
  await services.researchTopic(project);
  await services.generateScript(project);
  assert.equal(calls[0].url, "https://api.example.test/api/research/topic");
  assert.equal(calls[0].body.analysisMode, "deep");
  assert.equal(calls[1].url, "https://api.example.test/api/scripts/generate");
  assert.equal(calls[1].body.analysisMode, "deep");
});

test("Scriptwriter API receives the tailored brief, compact blueprint, and Fact Pack without a transcript", async () => {
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
  project.referenceBlueprint = referenceBlueprintFromAnalysis(project.analysis);
  project.research = await researchTopic(project);
  project.generatedScript = await services.generateScript(project);
  assert.equal(calls[0].url, "http://127.0.0.1:8787/api/scripts/generate");
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, "transcript"), false);
  assert.equal(calls[0].body.referenceBlueprint.analysisId, project.analysis.analysisId);
  assert.equal(calls[0].body.creativeBrief.targetAudience, project.creativeBrief.targetAudience);
  assert.equal(calls[0].body.factPack.researchId, project.research.researchId);
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
  project.referenceBlueprint = referenceBlueprintFromAnalysis(project.analysis);
  project.research = await researchTopic(project);
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
  assert.equal((html.match(/class="score-card /g) || []).length, 4);
  assert.match(html, /aria-label="Hook strength 80 out of 100"/);
  assert.match(html, /Four practical writing checks/);
  assert.doesNotMatch(html, /score-ring/);
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

test("Phase 6 mixed mode starts and polls a provider render", async () => {
  const calls = [];
  const updates = [];
  const services = createServices(
    {
      services: { transcript: "mock", analysis: "mock", script: "mock", review: "mock", storyboard: "mock", video: "api" },
      apiBaseUrl: "http://127.0.0.1:8787",
      renderPollIntervalMs: 1,
      renderPollLimit: 2,
    },
    async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "POST") return { ok: true, json: async () => ({ data: {
        renderId: "render_api", status: "queued", stage: "Planning scenes", progress: 5, completed: false, source: "provider",
      } }) };
      return { ok: true, json: async () => ({ data: {
        renderId: "render_api", status: "completed", stage: "Rendering final video", progress: 100, completed: true, source: "provider",
        videoUrl: "https://media.example.test/render.mp4", productionPackageUrl: "https://media.example.test/package.json",
        format: "9:16", duration: 60, voice: "Sora — Warm documentary", captionStyle: "Editorial high contrast", music: true,
      } }) };
    },
  );
  const project = createProject({ id: "project-phase-6", duration: 60, format: "9:16" });
  project.originalityReview = { reviewId: "review-approved", status: "passed" };
  project.storyboard = [{
    id: "scene-1", number: 1, start: 0, end: 60, duration: 60,
    narration: "Exact narration.", caption: "Exact evidence", visual: "Vertical evidence.", searchQuery: "licensed evidence", transition: "Fade up",
  }];
  const render = await services.renderVideo(project, (progress) => updates.push(progress));
  assert.equal(calls[0].url, "http://127.0.0.1:8787/api/videos/render");
  assert.equal(JSON.parse(calls[0].options.body).approvedReviewId, "review-approved");
  assert.equal(JSON.parse(calls[0].options.body).storyboard[0].id, "scene-1");
  assert.equal(calls[1].url, "http://127.0.0.1:8787/api/videos/render_api/status");
  assert.equal(updates.length, 2);
  assert.equal(render.source, "provider");
  assert.equal(render.videoUrl, "https://media.example.test/render.mp4");
});

test("Phase 6 polling stops at the configured status deadline", async () => {
  const services = createServices(
    {
      services: { transcript: "mock", analysis: "mock", script: "mock", review: "mock", storyboard: "mock", video: "api" },
      apiBaseUrl: "http://127.0.0.1:8787",
      renderPollIntervalMs: 1,
      renderPollLimit: 1,
    },
    async (_url, options = {}) => ({ ok: true, json: async () => ({ data: {
      renderId: "render_slow", status: options.method === "POST" ? "queued" : "running", stage: "Combining scenes", progress: 80, completed: false, source: "provider",
    } }) }),
  );
  const project = createProject({ id: "project-slow-render" });
  project.originalityReview = { reviewId: "review-approved", status: "passed" };
  project.storyboard = [{ id: "scene-1", number: 1, start: 0, end: 60, duration: 60 }];
  await assert.rejects(
    services.renderVideo(project),
    (error) => error.code === "RENDER_STATUS_TIMEOUT" && error.retryable === true,
  );
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

test("the completed production screen exposes provider delivery without mock claims", () => {
  const project = createProject();
  project.storyboard = [{
    id: "scene-1", number: 1, start: 0, end: 60, duration: 60,
    narration: "Narration", caption: "Caption", visual: "Visual", searchQuery: "Query", transition: "Fade up",
  }];
  project.render = {
    renderId: "render-provider", source: "provider", status: "completed", completed: true, progress: 100,
    videoUrl: "https://media.example.test/render.mp4", productionPackageUrl: "https://media.example.test/package.json",
    format: "9:16", duration: 60, voice: "Sora — Warm documentary", captionStyle: "Editorial high contrast", music: true,
  };
  const html = renderProduction(project);
  assert.match(html, /Open rendered video/);
  assert.match(html, /https:\/\/media\.example\.test\/package\.json/);
  assert.doesNotMatch(html, /no real video file was generated/i);
  assert.doesNotMatch(html, /data-action="export-video"/);
});

test("provider delivery remains usable when no package URL is supplied", () => {
  const project = createProject();
  project.storyboard = [{
    id: "scene-1", number: 1, start: 0, end: 60, duration: 60,
    narration: "Narration", caption: "Caption", visual: "Visual", searchQuery: "Query", transition: "Fade up",
  }];
  project.render = {
    source: "provider", status: "completed", completed: true, progress: 100,
    videoUrl: "https://cdn.shotstack.io/render.mp4", format: "9:16", duration: 60,
    voice: "Sora — Warm documentary", captionStyle: "Editorial high contrast", music: false,
  };
  const html = renderProduction(project);
  assert.match(html, /Open rendered video/);
  assert.doesNotMatch(html, /Production package<\/a>/);
  assert.doesNotMatch(html, /href="undefined"/);
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
