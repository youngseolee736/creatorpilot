import {
  createProject,
  manualTranscriptFromText,
  createStore,
  referenceBlueprintFromAnalysis,
  parseRoute,
  referenceTitleFromTranscript,
  routeFor,
  updatePipeline,
  wordCount,
  youtubeVideoId,
} from "./lib/core.mjs";
import {
  analyzeReference,
  extractTranscript,
  generateScript,
  generateStoryboard,
  generateStoryboardImage,
  researchTopic,
  reviseScript,
  synthesizeReferences,
} from "./services/api-client.mjs";
import { appShell } from "./ui/components.mjs";
import { renderDashboard } from "./pages/dashboard.mjs";
import { renderNewProject } from "./pages/new-project.mjs";
import { renderAnalysis } from "./pages/analysis.mjs";
import { renderResearch } from "./pages/research.mjs";
import { renderScriptEditor } from "./pages/script-editor.mjs";
import { renderProduction } from "./pages/production.mjs";

const app = document.querySelector("#app");
const store = createStore();
const runningTasks = new Set();
const MAX_AI_STORYBOARD_IMAGES = 3;
let newProjectError = null;
let newProjectDraft = {};
let lastRouteKey = "";
let autosaveTimer = null;

function fitScriptTextarea(field) {
  if (!field) return;
  field.style.height = "auto";
  field.style.height = `${field.scrollHeight}px`;
}

function fitScriptTextareas() {
  document.querySelectorAll("[data-script-section]").forEach(fitScriptTextarea);
}

function currentContext() {
  const route = parseRoute();
  const project = route.projectId ? store.getProject(route.projectId) : null;
  return { route, project };
}

function pageFor(route, project) {
  if (route.name === "dashboard") return renderDashboard(store.getState());
  if (route.name === "new") return renderNewProject(newProjectDraft, newProjectError);
  if (!project) return `<section class="not-found"><p class="eyebrow">Project unavailable</p><h1>This production could not be found.</h1><p>It may have been cleared from this browser.</p><a class="button button-primary" href="${routeFor("dashboard")}">Return to dashboard</a></section>`;
  if (route.name === "analysis") return renderAnalysis(project);
  if (route.name === "research") return renderResearch(project);
  if (route.name === "script") return renderScriptEditor(project);
  if (route.name === "production") return renderProduction(project);
  return renderDashboard(store.getState());
}

function render({ preserveFocus = false } = {}) {
  const { route, project } = currentContext();
  const routeKey = `${route.name}:${route.projectId || ""}`;
  app.innerHTML = appShell({ content: pageFor(route, project), route, project });
  fitScriptTextareas();
  document.title = `${project ? `${project.title} — ` : ""}${route.name === "dashboard" ? "Dashboard" : route.name === "new" ? "New project" : route.name} · CreatorPilot`;
  if (!preserveFocus && routeKey !== lastRouteKey) {
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => document.querySelector("#page-content")?.focus());
  }
  lastRouteKey = routeKey;
  ensureRouteData(route, project);
}

async function runTask(key, callback) {
  if (runningTasks.has(key)) return;
  runningTasks.add(key);
  try {
    await callback();
  } finally {
    runningTasks.delete(key);
  }
}

function failProject(project, stepId, error) {
  store.updateProject(project.id, {
    error: {
      message: error.message,
      code: error.code || "UNKNOWN",
      retryable: error.retryable ?? true,
      details: error.details || null,
    },
    pipeline: updatePipeline(project, stepId, "failed", "Agent stopped — retry available"),
  });
  render({ preserveFocus: true });
  requestAnimationFrame(() => document.querySelector("#service-error")?.focus());
}

async function ensureAnalysis(project) {
  await runTask(`analysis:${project.id}`, async () => {
    let current = store.getProject(project.id);
    try {
      const references = current.references || [];
      const missingTranscripts = references.filter((reference) => !reference.transcript);
      if (missingTranscripts.length) {
        current = store.updateProject(project.id, {
          status: "analyzing",
          error: null,
          pipeline: updatePipeline(current, "transcript", "in_progress", `Extracting ${missingTranscripts.length} reference transcripts`),
        });
        render({ preserveFocus: true });
        const transcriptResults = await Promise.allSettled(missingTranscripts.map(async (reference) => ({
          referenceId: reference.referenceId,
          transcript: await extractTranscript(current, reference),
        })));
        const completedTranscripts = new Map(transcriptResults.filter((result) => result.status === "fulfilled").map((result) => [result.value.referenceId, result.value.transcript]));
        const nextReferences = current.references.map((item) => {
          const transcript = completedTranscripts.get(item.referenceId);
          return transcript ? { ...item, transcript, title: referenceTitleFromTranscript(transcript, item.title) } : item;
        });
        const firstTranscript = nextReferences[0]?.transcript || current.transcript;
        current = store.updateProject(project.id, {
          references: nextReferences,
          transcript: firstTranscript,
          referenceTitle: nextReferences[0]?.title || current.referenceTitle,
          pipeline: updatePipeline(current, "transcript", "completed", `${nextReferences.filter((reference) => reference.transcript).length} of ${references.length} transcripts ready`),
        });
        const transcriptFailure = transcriptResults.find((result) => result.status === "rejected");
        if (transcriptFailure) throw transcriptFailure.reason;
      }

      current = store.getProject(project.id);
      const missingAnalyses = current.references.filter((reference) => !hasStoryLogic(reference.analysis));
      if (missingAnalyses.length) {
        current = store.updateProject(project.id, {
          pipeline: updatePipeline(current, "analyst", "in_progress", `Analyzing ${missingAnalyses.length} references independently`),
        });
        render({ preserveFocus: true });
        const analysisResults = await Promise.allSettled(missingAnalyses.map(async (reference) => ({
          referenceId: reference.referenceId,
          analysis: await analyzeReference(current, reference),
        })));
        const completedAnalyses = new Map(analysisResults.filter((result) => result.status === "fulfilled").map((result) => [result.value.referenceId, result.value.analysis]));
        const nextReferences = current.references.map((item) => completedAnalyses.has(item.referenceId) ? { ...item, analysis: completedAnalyses.get(item.referenceId) } : item);
        current = store.updateProject(project.id, {
          references: nextReferences,
          pipeline: updatePipeline(current, "analyst", "in_progress", `${nextReferences.filter((reference) => hasStoryLogic(reference.analysis)).length} of ${current.references.length} analyses ready`),
        });
        const analysisFailure = analysisResults.find((result) => result.status === "rejected");
        if (analysisFailure) throw analysisFailure.reason;
      }

      current = store.getProject(project.id);
      if (!hasStoryLogic(current.analysis)) {
        current = store.updateProject(project.id, {
          pipeline: updatePipeline(
            current,
            "analyst",
            "in_progress",
            current.references.length > 1
              ? (current.analysisDepth === "deep" ? "Comparing two blueprints with the Final Judge" : "Combining the strongest story patterns")
              : "Preparing the story blueprint",
          ),
        });
        render({ preserveFocus: true });
        const analysis = current.references.length >= 3
          ? await synthesizeReferences(current)
          : current.references[0]?.analysis;
        current = store.updateProject(project.id, {
          analysis,
          status: "reference_added",
          pipeline: updatePipeline(current, "analyst", "completed", `${current.references.length} references combined`),
        });
      }
      render({ preserveFocus: true });
    } catch (error) {
      const stepId = current.references?.every((reference) => reference.transcript) ? "analyst" : "transcript";
      failProject(current, stepId, error);
    }
  });
}

function hasStoryLogic(analysis) {
  return Boolean(
    analysis
    && analysis.hookMechanics
    && Array.isArray(analysis.narrativeStyle?.progression)
    && Array.isArray(analysis.informationFlow?.sequence)
    && analysis.appliedExamples?.opening
    && analysis.appliedExamples?.build
    && analysis.appliedExamples?.payoff
    && Array.isArray(analysis.retentionMap)
    && Array.isArray(analysis.reusablePatterns),
  );
}

async function ensureScript(project, { force = false } = {}) {
  await runTask(`script:${project.id}`, async () => {
    let current = store.getProject(project.id);
    if (current.generatedScript && !force) return;
    try {
      current = store.updateProject(project.id, {
        error: null,
        generatedScript: force ? null : current.generatedScript,
        pipeline: updatePipeline(current, "writer", "in_progress", current.analysisDepth === "deep" ? "Comparing two drafts with the Writing Judge" : (force ? "Writing a new version" : "Drafting original narration")),
      });
      render({ preserveFocus: true });
      const generatedScript = await generateScript(current);
      current = store.updateProject(project.id, {
        generatedScript,
        status: "script_generated",
        pipeline: updatePipeline(current, "writer", "completed", `Draft ${generatedScript.version} ready for editing`),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "writer", error);
    }
  });
}

async function ensureResearch(project) {
  await runTask(`research:${project.id}`, async () => {
    let current = store.getProject(project.id);
    if (hasResearchStrategy(current.research)) return;
    try {
      const referenceBlueprint = current.referenceBlueprint || referenceBlueprintFromAnalysis(current.analysis);
      current = store.updateProject(project.id, {
        error: null,
        research: null,
        status: "researching",
        referenceBlueprint,
        pipeline: resetResearchPipeline(current, "in_progress", "Collecting a compact source-grounded evidence pack"),
      });
      render({ preserveFocus: true });
      const research = await researchTopic(current);
      current = store.updateProject(project.id, {
        research,
        generatedScript: null,
        storyboard: [],
        status: "research_ready",
        pipeline: updatePipeline(current, "researcher", "completed", `${research.facts.length} story-ready findings`),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "researcher", error);
    }
  });
}

function resetResearchPipeline(project, status, detail) {
  return {
    ...updatePipeline(project, "researcher", status, detail),
    writer: { status: "waiting", detail: "Waiting for the new research" },
    producer: { status: "waiting", detail: "Waiting for the storyboard preview" },
  };
}

function hasResearchStrategy(research) {
  return Boolean(
    research
    && research.verdict?.status
    && research.narrativeCase?.mode
    && Array.isArray(research.narrativeCase?.supportFactIds)
    && Array.isArray(research.criteria)
    && Array.isArray(research.comparisonSet)
    && Array.isArray(research.comparisons)
    && research.counterpoint?.claim
    && Array.isArray(research.storyFindings),
  );
}

async function ensureScriptRevision(project, revisionInstructions) {
  await runTask(`script:${project.id}`, async () => {
    let current = store.getProject(project.id);
    if (!current.generatedScript) return ensureScript(current);
    const instructions = revisionInstructions?.length
      ? revisionInstructions
      : ["Create a fresh version with distinct wording while preserving the brief and section functions."];
    try {
      current = store.updateProject(project.id, {
        error: null,
        pendingRevisionInstructions: instructions,
        pipeline: updatePipeline(current, "writer", "in_progress", current.analysisDepth === "deep" ? "Comparing two revised drafts with the Writing Judge" : "Writing a new version"),
      });
      render({ preserveFocus: true });
      const generatedScript = await reviseScript(current, instructions);
      current = store.updateProject(project.id, {
        generatedScript,
        pendingRevisionInstructions: null,
        status: "script_generated",
        pipeline: updatePipeline(current, "writer", "completed", `Draft ${generatedScript.version} ready for editing`),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "writer", error);
    }
  });
}

async function ensureStoryboard(project) {
  await runTask(`storyboard:${project.id}`, async () => {
    let current = store.getProject(project.id);
    if (current.storyboard.length) return;
    try {
      current = store.updateProject(project.id, {
        error: null,
        pipeline: updatePipeline(current, "producer", "in_progress", "Planning scenes and visual evidence"),
      });
      render({ preserveFocus: true });
      const storyboard = await generateStoryboard(current);
      current = store.updateProject(project.id, {
        storyboard,
        status: "under_review",
        pipeline: updatePipeline(current, "producer", "completed", `${storyboard.length} scene preview ready`),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "producer", error);
    }
  });
}

async function ensureStoryboardImages(project) {
  await runTask(`storyboard-images:${project.id}`, async () => {
    let current = store.getProject(project.id);
    if (!current?.storyboard?.length) return;
    const existingImages = current.storyboard.filter((scene) => scene.imageDataUrl).length;
    const imageSlotsRemaining = Math.max(0, MAX_AI_STORYBOARD_IMAGES - existingImages);
    const imageSceneIds = new Set(current.storyboard
      .filter((scene) => !scene.imageDataUrl)
      .slice(0, imageSlotsRemaining)
      .map((scene) => scene.id));
    if (!imageSceneIds.size) return;
    current = store.updateProject(project.id, {
      imagePreviewStatus: "in_progress",
      storyboard: current.storyboard.map((scene) => !imageSceneIds.has(scene.id)
        ? { ...scene, imageStatus: scene.imageDataUrl ? "completed" : scene.imageStatus }
        : { ...scene, imageStatus: "in_progress", imageError: null }),
    });
    render({ preserveFocus: true });
    let failures = 0;
    for (const scene of current.storyboard) {
      if (!imageSceneIds.has(scene.id)) continue;
      try {
        const image = await generateStoryboardImage(store.getProject(project.id), scene);
        const latest = store.getProject(project.id);
        store.updateProject(project.id, {
          storyboard: latest.storyboard.map((item) => item.id === scene.id
            ? {
              ...item,
              imageDataUrl: image.imageDataUrl,
              imageSource: "ai",
              imageModel: image.model,
              imagePrompt: image.prompt || item.imagePrompt,
              imageStatus: "completed",
              imageError: null,
            }
            : item),
        });
      } catch (error) {
        failures += 1;
        const latest = store.getProject(project.id);
        store.updateProject(project.id, {
          storyboard: latest.storyboard.map((item) => item.id === scene.id
            ? { ...item, imageStatus: "failed", imageError: error.message || "Image generation failed" }
            : item),
        });
      }
      render({ preserveFocus: true });
    }
    const latest = store.getProject(project.id);
    const completedCount = latest.storyboard.filter((scene) => scene.imageDataUrl).length;
    store.updateProject(project.id, {
      imagePreviewStatus: failures ? "failed" : "completed",
      pipeline: updatePipeline(latest, "producer", failures ? "completed" : "completed", failures ? "Storyboard ready; some image previews failed" : `Storyboard ready; ${completedCount} key image previews ready`),
    });
    render({ preserveFocus: true });
  });
}

function ensureRouteData(route, project) {
  if (!project || project.error) return;
  if (route.name === "analysis" && !hasStoryLogic(project.analysis)) ensureAnalysis(project);
  if (route.name === "research" && !hasResearchStrategy(project.research)) ensureResearch(project);
  if (route.name === "script" && !hasResearchStrategy(project.research)) navigate(routeFor("research", project.id));
  else if (route.name === "script" && !project.generatedScript) ensureScript(project);
  if (route.name === "production" && !project.storyboard.length) ensureStoryboard(project);
}

function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
  render();
}

function saveScriptForm(project) {
  const form = document.querySelector("#script-form");
  if (!form || !project.generatedScript) return project;
  const sections = project.generatedScript.sections.map((section) => ({
    ...section,
    text: form.querySelector(`[data-section-id="${section.id}"] textarea`).value.trim(),
  }));
  const title = form.querySelector("#script-title").value.trim() || project.topic;
  return store.updateProject(project.id, {
    generatedScript: { ...project.generatedScript, title, sections },
    title,
    status: "script_generated",
  });
}

function quietSaveScript(projectId) {
  const form = document.querySelector("#script-form");
  const project = store.getProject(projectId);
  if (!form || !project?.generatedScript) return;
  const sections = project.generatedScript.sections.map((section) => ({
    ...section,
    text: form.querySelector(`[data-section-id="${section.id}"] textarea`).value.trim(),
  }));
  const title = form.querySelector("#script-title").value.trim() || project.topic;
  const patch = { generatedScript: { ...project.generatedScript, title, sections }, title };
  store.updateProject(projectId, patch);
}

function scheduleScriptAutosave() {
  const { project } = currentContext();
  if (!project) return;
  const stateNode = document.querySelector("#autosave-state");
  if (stateNode) stateNode.textContent = "Saving…";
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    quietSaveScript(project.id);
    const savedNode = document.querySelector("#autosave-state");
    if (savedNode) savedNode.textContent = "Auto-saved locally";
  }, 600);
}

app.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "reference-form") {
    const values = Object.fromEntries(new FormData(event.target));
    newProjectDraft = values;
    const transcripts = [1, 2, 3, 4, 5].map((position) => values[`referenceTranscript${position}`]?.trim()).filter(Boolean);
    const requiredTranscripts = [1, 2, 3].map((position) => values[`referenceTranscript${position}`]?.trim()).filter(Boolean);
    const urls = [1, 2, 3, 4, 5].map((position) => values[`referenceUrl${position}`]?.trim()).filter(Boolean);
    const videoIds = urls.map(youtubeVideoId);
    const validUrl = videoIds.every(Boolean);
    const uniqueUrls = new Set(videoIds).size === videoIds.length;
    const missingBrief = !values.topic?.trim();
    if (requiredTranscripts.length < 3 || !validUrl || !uniqueUrls || missingBrief) {
      newProjectError = requiredTranscripts.length < 3
        ? "Paste all three required reference transcripts."
        : !validUrl
          ? "If you add YouTube URLs, use valid ones for every reference."
          : !uniqueUrls
            ? "Each reference must use a different YouTube URL."
            : "Describe the new video topic so the result can be tailored.";
      render({ preserveFocus: true });
      return;
    }
    newProjectError = null;
    const project = store.addProject(createProject(values));
    newProjectDraft = {};
    navigate(routeFor("analysis", project.id));
  }
  if (event.target.id === "manual-transcript-form") {
    const { project } = currentContext();
    if (!project) return;
    const values = Object.fromEntries(new FormData(event.target));
    const references = project.references || [];
    const manualByReferenceId = new Map(
      Object.entries(values)
        .filter(([key, value]) => key.startsWith("manualTranscript:") && String(value || "").trim())
        .map(([key, value]) => [key.split(":")[1], String(value || "").trim()]),
    );
    if (!manualByReferenceId.size) {
      store.updateProject(project.id, {
        error: { message: "Paste at least one transcript before continuing.", code: "MANUAL_TRANSCRIPT_REQUIRED", retryable: false, details: null },
      });
      render({ preserveFocus: true });
      return;
    }
    const nextReferences = references.map((reference) => {
      const text = manualByReferenceId.get(reference.referenceId);
      if (!text) return reference;
      return {
        ...reference,
        transcript: manualTranscriptFromText({
          projectId: project.id,
          referenceId: reference.referenceId,
          title: reference.title,
          language: project.language,
          text,
          estimatedDuration: project.duration,
        }),
      };
    });
    const updated = store.updateProject(project.id, {
      error: null,
      references: nextReferences,
      transcript: nextReferences[0]?.transcript || project.transcript,
      referenceTitle: nextReferences[0]?.title || project.referenceTitle,
      pipeline: {
        ...updatePipeline(project, "transcript", "completed", `${nextReferences.filter((reference) => reference.transcript).length} of ${nextReferences.length} transcripts ready`),
        analyst: { status: "waiting", detail: "Manual transcript ready for analysis" },
        researcher: { status: "waiting", detail: "Waiting for the previous stage" },
        writer: { status: "waiting", detail: "Waiting for the previous stage" },
        producer: { status: "waiting", detail: "Waiting for the previous stage" },
      },
    });
    render({ preserveFocus: true });
    ensureAnalysis(updated);
  }
  if (event.target.id === "script-form") {
    const { project } = currentContext();
    const saved = saveScriptForm(project);
    const queued = store.updateProject(saved.id, {
      pipeline: updatePipeline(saved, "producer", "in_progress", "Planning scenes and visual evidence"),
    });
    navigate(routeFor("production", queued.id));
    ensureStoryboard(queued);
  }
});

app.addEventListener("input", (event) => {
  if (event.target.matches("#script-title")) {
    scheduleScriptAutosave();
    return;
  }
  if (!event.target.matches("[data-script-section]")) return;
  fitScriptTextarea(event.target);
  const form = event.target.form;
  const text = [...form.querySelectorAll("[data-script-section]")].map((field) => field.value).join(" ");
  const display = form.querySelector("#word-count");
  if (display) display.textContent = text.trim().split(/\s+/).filter(Boolean).length;
  scheduleScriptAutosave();
});

app.addEventListener("click", async (event) => {
  const sectionLink = event.target.closest(".section-nav a[href^='#section-']");
  if (sectionLink) {
    event.preventDefault();
    const target = document.querySelector(sectionLink.getAttribute("href"));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    }
    return;
  }
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  const { route, project } = currentContext();
  if (!project && !["clear-projects", "delete-project"].includes(action)) return;
  if (action === "research-topic") navigate(routeFor("research", project.id));
  if (action === "rerun-analysis") {
    const pipeline = {
      ...updatePipeline(project, "analyst", "waiting", "New analysis queued"),
      researcher: { status: "waiting", detail: "Waiting for the new analysis" },
      writer: { status: "waiting", detail: "Waiting for the previous stage" },
      producer: { status: "waiting", detail: "Waiting for the previous stage" },
    };
    store.updateProject(project.id, {
      error: null,
      analysis: null,
      references: project.references.map((reference) => ({ ...reference, analysis: null })),
      referenceBlueprint: null,
      research: null,
      generatedScript: null,
      storyboard: [],
      pipeline,
    });
    render({ preserveFocus: true });
    ensureAnalysis(store.getProject(project.id));
  }
  if (action === "rerun-research") {
    store.updateProject(project.id, {
      error: null,
      research: null,
      generatedScript: null,
      storyboard: [],
      pipeline: resetResearchPipeline(project, "waiting", "New research queued"),
    });
    render({ preserveFocus: true });
    ensureResearch(store.getProject(project.id));
  }
  if (action === "generate-script") navigate(routeFor("script", project.id));
  if (action === "regenerate-script") {
    const saved = saveScriptForm(project);
    const instructions = saved.pendingRevisionInstructions
      || ["Create a fresh version with distinct wording while preserving the brief and section functions."];
    ensureScriptRevision(saved, instructions);
  }
  if (action === "save-script") {
    saveScriptForm(project);
    control.textContent = "Changes saved";
    setTimeout(() => render({ preserveFocus: true }), 700);
  }
  if (action === "approve-production") {
    const saved = saveScriptForm(project);
    const queued = store.updateProject(saved.id, {
      pipeline: updatePipeline(saved, "producer", "in_progress", "Planning scenes and visual evidence"),
    });
    navigate(routeFor("production", queued.id));
    ensureStoryboard(queued);
  }
  if (action === "regenerate-storyboard") {
    const queued = store.updateProject(project.id, {
      error: null,
      storyboard: [],
      status: "script_generated",
      pipeline: updatePipeline(project, "producer", "in_progress", "Regenerating storyboard preview"),
    });
    render({ preserveFocus: true });
    ensureStoryboard(queued);
  }
  if (action === "generate-storyboard-images") {
    ensureStoryboardImages(project);
  }
  if (action === "retry-analysis") {
    store.updateProject(project.id, {
      error: null,
      analysis: null,
      referenceBlueprint: null,
      research: null,
      generatedScript: null,
      storyboard: [],
      pipeline: {
        ...updatePipeline(project, project.references?.every((reference) => reference.transcript) ? "analyst" : "transcript", "waiting", "Retry queued"),
        researcher: { status: "waiting", detail: "Waiting for the new analysis" },
        writer: { status: "waiting", detail: "Waiting for the previous stage" },
        producer: { status: "waiting", detail: "Waiting for the previous stage" },
      },
    });
    render({ preserveFocus: true });
    ensureAnalysis(store.getProject(project.id));
  }
  if (action === "retry-script") {
    store.updateProject(project.id, { error: null });
    render({ preserveFocus: true });
    const current = store.getProject(project.id);
    if (current.generatedScript && current.pendingRevisionInstructions?.length) {
      ensureScriptRevision(current, current.pendingRevisionInstructions);
    } else {
      ensureScript(current);
    }
  }
  if (action === "retry-research") {
    store.updateProject(project.id, { error: null, research: null, generatedScript: null, storyboard: [], pipeline: resetResearchPipeline(project, "waiting", "Retry queued") });
    render({ preserveFocus: true });
    ensureResearch(store.getProject(project.id));
  }
  if (action === "retry-storyboard") {
    store.updateProject(project.id, { error: null });
    render({ preserveFocus: true });
    ensureStoryboard(store.getProject(project.id));
  }
  if (action === "delete-project") {
    const target = project || store.getProject(control.dataset.projectId);
    if (!target) return;
    const confirmed = window.confirm(`Delete "${target.title}"? This removes the project from this browser and cannot be undone.`);
    if (!confirmed) return;
    store.deleteProject(target.id);
    if (route.name === "dashboard") render();
    else navigate(routeFor("dashboard"));
  }
  if (action === "clear-projects") {
    store.clearProjects();
    navigate(routeFor("dashboard"));
  }
  if (route.name === "script" && action !== "regenerate-script") {
    const count = wordCount(store.getProject(project.id)?.generatedScript);
    const countNode = document.querySelector("#word-count");
    if (countNode) countNode.textContent = count;
  }
});

window.addEventListener("hashchange", () => render());
if (!location.hash) location.hash = routeFor("dashboard");
else render();
