import {
  createProject,
  createStore,
  parseRoute,
  routeFor,
  updatePipeline,
  wordCount,
} from "./core.mjs";
import {
  analyzeReference,
  extractTranscript,
  generateScript,
  generateStoryboard,
  renderVideo,
  reviewOriginality,
} from "./service-client.mjs";
import { appShell } from "./components.mjs";
import { renderDashboard } from "./pages/dashboard.mjs";
import { renderNewProject } from "./pages/new-project.mjs";
import { renderAnalysis } from "./pages/analysis.mjs";
import { renderScriptEditor } from "./pages/script-editor.mjs";
import { renderReview } from "./pages/review.mjs";
import { renderProduction } from "./pages/production.mjs";

const app = document.querySelector("#app");
const store = createStore();
const runningTasks = new Set();
let newProjectError = null;
let newProjectDraft = {};
let lastRouteKey = "";

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
  if (route.name === "script") return renderScriptEditor(project);
  if (route.name === "review") return renderReview(project);
  if (route.name === "production") return renderProduction(project);
  return renderDashboard(store.getState());
}

function render({ preserveFocus = false } = {}) {
  const { route, project } = currentContext();
  const routeKey = `${route.name}:${route.projectId || ""}`;
  app.innerHTML = appShell({ content: pageFor(route, project), route, project });
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
    error: { message: error.message, code: error.code || "UNKNOWN" },
    pipeline: updatePipeline(project, stepId, "failed", "Agent stopped — retry available"),
  });
  render({ preserveFocus: true });
  requestAnimationFrame(() => document.querySelector("#service-error")?.focus());
}

async function ensureAnalysis(project) {
  await runTask(`analysis:${project.id}`, async () => {
    let current = store.getProject(project.id);
    try {
      if (!current.transcript) {
        current = store.updateProject(project.id, {
          status: "analyzing",
          error: null,
          pipeline: updatePipeline(current, "transcript", "in_progress", "Extracting reference transcript"),
        });
        render({ preserveFocus: true });
        const transcript = await extractTranscript(current);
        current = store.updateProject(project.id, {
          transcript,
          referenceTitle: transcript.title,
          pipeline: updatePipeline(current, "transcript", "completed", `${transcript.wordCount} words extracted`),
        });
      }
      if (!current.analysis) {
        current = store.updateProject(project.id, {
          pipeline: updatePipeline(current, "analyst", "in_progress", "Mapping hook, pacing, and structure"),
        });
        render({ preserveFocus: true });
        const analysis = await analyzeReference(current);
        current = store.updateProject(project.id, {
          analysis,
          status: "reference_added",
          pipeline: updatePipeline(current, "analyst", "completed", "Structure mapped for adaptation"),
        });
      }
      render({ preserveFocus: true });
    } catch (error) {
      const stepId = current.transcript ? "analyst" : "transcript";
      failProject(current, stepId, error);
    }
  });
}

async function ensureScript(project, { force = false } = {}) {
  await runTask(`script:${project.id}`, async () => {
    let current = store.getProject(project.id);
    if (current.generatedScript && !force) return;
    try {
      current = store.updateProject(project.id, {
        error: null,
        generatedScript: force ? null : current.generatedScript,
        pipeline: updatePipeline(current, "writer", "in_progress", force ? "Writing a new version" : "Drafting original narration"),
      });
      render({ preserveFocus: true });
      const generatedScript = await generateScript(current);
      current = store.updateProject(project.id, {
        generatedScript,
        originalityReview: null,
        status: "script_generated",
        pipeline: updatePipeline(current, "writer", "completed", `Draft ${generatedScript.version} ready for editing`),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "writer", error);
    }
  });
}

async function ensureReview(project) {
  await runTask(`review:${project.id}`, async () => {
    let current = store.getProject(project.id);
    if (current.originalityReview) return;
    try {
      current = store.updateProject(project.id, {
        error: null,
        status: "under_review",
        pipeline: updatePipeline(current, "reviewer", "in_progress", "Comparing language and story structure"),
      });
      render({ preserveFocus: true });
      const originalityReview = await reviewOriginality(current);
      current = store.updateProject(project.id, {
        originalityReview,
        status: originalityReview.status === "passed" ? "under_review" : "revision_required",
        pipeline: updatePipeline(current, "reviewer", originalityReview.status === "passed" ? "completed" : "revision_required", originalityReview.status === "passed" ? "Originality estimate passed" : "Revision instructions ready"),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "reviewer", error);
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
        status: current.render?.completed ? "completed" : "under_review",
        pipeline: updatePipeline(current, "producer", "waiting", `${storyboard.length} scenes ready — awaiting approval`),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "producer", error);
    }
  });
}

async function startRender(project) {
  await runTask(`render:${project.id}`, async () => {
    let current = store.getProject(project.id);
    try {
      current = store.updateProject(project.id, {
        error: null,
        status: "video_rendering",
        render: { stage: "Preparing production", progress: 2, completed: false },
        pipeline: updatePipeline(current, "producer", "in_progress", "Preparing the vertical render"),
      });
      render({ preserveFocus: true });
      const result = await renderVideo(current, (progress) => {
        current = store.updateProject(project.id, {
          render: { ...progress, completed: false },
          pipeline: updatePipeline(current, "producer", "in_progress", progress.stage),
        });
        render({ preserveFocus: true });
      });
      store.updateProject(project.id, {
        render: result,
        status: "completed",
        pipeline: updatePipeline(current, "producer", "completed", "Vertical video ready"),
      });
      render({ preserveFocus: true });
    } catch (error) {
      failProject(current, "producer", error);
    }
  });
}

function ensureRouteData(route, project) {
  if (!project || project.error) return;
  if (route.name === "analysis" && !project.analysis) ensureAnalysis(project);
  if (route.name === "script" && !project.generatedScript) ensureScript(project);
  if (route.name === "review" && !project.originalityReview) ensureReview(project);
  if (route.name === "production" && !project.storyboard.length) ensureStoryboard(project);
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
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
    originalityReview: null,
    status: "script_generated",
    pipeline: updatePipeline(project, "reviewer", "waiting", "Waiting for the updated script"),
  });
}

app.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "reference-form") {
    const values = Object.fromEntries(new FormData(event.target));
    newProjectDraft = values;
    const validUrl = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(values.referenceUrl || "");
    if (!validUrl || !values.topic?.trim()) {
      newProjectError = !validUrl ? "Enter a valid YouTube URL." : "Enter a topic for the new video.";
      render({ preserveFocus: true });
      return;
    }
    newProjectError = null;
    const project = store.addProject(createProject(values));
    newProjectDraft = {};
    navigate(routeFor("analysis", project.id));
  }
  if (event.target.id === "script-form") {
    const { project } = currentContext();
    const saved = saveScriptForm(project);
    navigate(routeFor("review", saved.id));
  }
});

app.addEventListener("input", (event) => {
  if (!event.target.matches("[data-script-section]")) return;
  const form = event.target.form;
  const text = [...form.querySelectorAll("[data-script-section]")].map((field) => field.value).join(" ");
  const display = form.querySelector("#word-count");
  if (display) display.textContent = text.trim().split(/\s+/).filter(Boolean).length;
});

app.addEventListener("change", (event) => {
  const setting = event.target.dataset.projectSetting;
  if (!setting) return;
  const { project } = currentContext();
  if (!project) return;
  const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  store.updateProject(project.id, {
    productionSettings: { ...project.productionSettings, [setting]: value },
  });
  render({ preserveFocus: true });
});

app.addEventListener("click", async (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  const { route, project } = currentContext();
  if (!project && !["clear-projects"].includes(action)) return;
  if (action === "generate-script") navigate(routeFor("script", project.id));
  if (action === "regenerate-script") {
    saveScriptForm(project);
    store.updateProject(project.id, { generatedScript: null, originalityReview: null });
    render({ preserveFocus: true });
    ensureScript(store.getProject(project.id), { force: true });
  }
  if (action === "save-script") {
    saveScriptForm(project);
    control.textContent = "Changes saved";
    setTimeout(() => render({ preserveFocus: true }), 700);
  }
  if (action === "send-back-script") {
    store.updateProject(project.id, {
      status: "revision_required",
      originalityReview: null,
      pipeline: updatePipeline(project, "reviewer", "revision_required", "Returned with revision guidance"),
    });
    navigate(routeFor("script", project.id));
  }
  if (action === "approve-production") navigate(routeFor("production", project.id));
  if (action === "render-video") startRender(project);
  if (action === "regenerate-video") {
    store.updateProject(project.id, { render: null, status: "under_review", pipeline: updatePipeline(project, "producer", "in_progress", "Storyboard ready for a new render") });
    render({ preserveFocus: true });
  }
  if (action === "toggle-preview") {
    control.classList.toggle("is-playing");
    control.setAttribute("aria-label", control.classList.contains("is-playing") ? "Pause mock video preview" : "Play mock video preview");
  }
  if (action === "export-video") {
    const payload = { ...project, note: "CreatorPilot mock production package — no media file generated" };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.id}-creatorpilot-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  if (action === "retry-analysis") {
    store.updateProject(project.id, { error: null, pipeline: updatePipeline(project, project.transcript ? "analyst" : "transcript", "waiting", "Retry queued") });
    render({ preserveFocus: true });
    ensureAnalysis(store.getProject(project.id));
  }
  if (action === "retry-script") {
    store.updateProject(project.id, { error: null });
    render({ preserveFocus: true });
    ensureScript(store.getProject(project.id));
  }
  if (action === "retry-review") {
    store.updateProject(project.id, { error: null });
    render({ preserveFocus: true });
    ensureReview(store.getProject(project.id));
  }
  if (action === "retry-storyboard") {
    store.updateProject(project.id, { error: null });
    render({ preserveFocus: true });
    ensureStoryboard(store.getProject(project.id));
  }
  if (action === "retry-render") {
    store.updateProject(project.id, { error: null });
    startRender(store.getProject(project.id));
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
