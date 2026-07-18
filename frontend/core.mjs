export const STORAGE_KEY = "creatorpilot:v1";

export const PIPELINE_STEPS = [
  { id: "transcript", label: "Transcript extracted", agent: "Reference intake" },
  { id: "analyst", label: "Script Analyst", agent: "Structure and retention" },
  { id: "writer", label: "Scriptwriter", agent: "Original narration" },
  { id: "reviewer", label: "Originality Reviewer", agent: "Similarity review" },
  { id: "producer", label: "Video Producer", agent: "Storyboard and render" },
];

export const STATUS_LABELS = {
  reference_added: "Reference added",
  analyzing: "Analyzing",
  script_generated: "Script generated",
  under_review: "Under review",
  revision_required: "Revision required",
  video_rendering: "Video rendering",
  completed: "Completed",
  waiting: "Waiting",
  in_progress: "In progress",
  failed: "Failed",
  passed: "Passed",
};

export function referenceTitleFromTranscript(transcript, fallback = "Reference video") {
  return String(transcript?.title || "").trim() || fallback;
}

function pipelineState(overrides = {}) {
  return Object.fromEntries(
    PIPELINE_STEPS.map((step) => [
      step.id,
      { status: "waiting", detail: "Waiting for the previous stage", ...overrides[step.id] },
    ]),
  );
}

export function createProject(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `project-${Date.now()}`,
    title: input.topic || "Untitled short",
    referenceUrl: input.referenceUrl || "",
    referenceTitle: input.referenceTitle || "Reference video",
    topic: input.topic || "",
    language: input.language || "Korean",
    duration: Number(input.duration || 60),
    format: input.format || "9:16",
    status: input.status || "reference_added",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    transcript: input.transcript || null,
    analysis: input.analysis || null,
    generatedScript: input.generatedScript || null,
    originalityReview: input.originalityReview || null,
    storyboard: input.storyboard || [],
    render: input.render || null,
    finalVideoUrl: input.finalVideoUrl || null,
    productionSettings: input.productionSettings || {
      voice: "Sora — Warm documentary",
      captions: "Editorial high contrast",
      music: true,
    },
    pipeline: input.pipeline || pipelineState(),
    error: null,
  };
}

export function seedProjects() {
  return [
    createProject({
      id: "project-archipelago",
      topic: "Why cities are building floating neighborhoods",
      referenceUrl: "https://youtube.com/watch?v=demo-floating",
      referenceTitle: "The next generation of coastal cities",
      language: "English",
      status: "completed",
      updatedAt: "2026-07-17T08:40:00.000Z",
      pipeline: pipelineState({
        transcript: { status: "completed", detail: "Transcript ready" },
        analyst: { status: "completed", detail: "Structure mapped" },
        writer: { status: "completed", detail: "Script approved" },
        reviewer: { status: "completed", detail: "Originality estimate passed" },
        producer: { status: "completed", detail: "Vertical video ready" },
      }),
      render: { progress: 100, stage: "Final video ready", completed: true },
    }),
    createProject({
      id: "project-focus",
      topic: "The two-minute rule for better focus",
      referenceUrl: "https://youtube.com/watch?v=demo-focus",
      referenceTitle: "A productivity habit that actually sticks",
      status: "revision_required",
      updatedAt: "2026-07-16T02:15:00.000Z",
      pipeline: pipelineState({
        transcript: { status: "completed", detail: "Transcript ready" },
        analyst: { status: "completed", detail: "Structure mapped" },
        writer: { status: "completed", detail: "Draft 1 generated" },
        reviewer: { status: "revision_required", detail: "Two phrases need revision" },
      }),
    }),
  ];
}

function initialState() {
  return { version: 1, projects: seedProjects(), activeProjectId: null };
}

export function createStore(storage = globalThis.localStorage) {
  let state = initialState();

  function load() {
    if (!storage) return state;
    try {
      const stored = JSON.parse(storage.getItem(STORAGE_KEY));
      if (stored?.version === 1 && Array.isArray(stored.projects)) state = stored;
    } catch {
      state = initialState();
    }
    return state;
  }

  function save() {
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getState() {
    return state;
  }

  function getProject(id) {
    return state.projects.find((project) => project.id === id) || null;
  }

  function addProject(project) {
    state.projects.unshift(project);
    state.activeProjectId = project.id;
    save();
    return project;
  }

  function updateProject(id, patch) {
    const index = state.projects.findIndex((project) => project.id === id);
    if (index < 0) return null;
    const current = state.projects[index];
    const nextPatch = typeof patch === "function" ? patch(current) : patch;
    state.projects[index] = {
      ...current,
      ...nextPatch,
      updatedAt: new Date().toISOString(),
    };
    save();
    return state.projects[index];
  }

  function clearProjects() {
    state = { version: 1, projects: [], activeProjectId: null };
    save();
  }

  load();
  return { getState, getProject, addProject, updateProject, clearProjects, load };
}

export function updatePipeline(project, stepId, status, detail) {
  return {
    ...project.pipeline,
    [stepId]: { status, detail },
  };
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDate(value) {
  if (!value) return "Not edited yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(Math.round(seconds % 60)).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function wordCount(script) {
  if (!script?.sections) return 0;
  return script.sections
    .map((section) => section.text)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function routeFor(name, projectId = "") {
  const routes = {
    dashboard: "#/dashboard",
    new: "#/projects/new",
    analysis: `#/projects/${projectId}/analysis`,
    script: `#/projects/${projectId}/script`,
    review: `#/projects/${projectId}/review`,
    production: `#/projects/${projectId}/production`,
  };
  return routes[name] || routes.dashboard;
}

export function parseRoute(hash = globalThis.location?.hash || "") {
  const path = hash.replace(/^#/, "") || "/dashboard";
  if (path === "/dashboard") return { name: "dashboard" };
  if (path === "/projects/new") return { name: "new" };
  const match = path.match(/^\/projects\/([^/]+)\/(analysis|script|review|production)$/);
  if (match) return { name: match[2], projectId: match[1] };
  return { name: "not-found" };
}
