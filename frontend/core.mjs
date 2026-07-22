export const STORAGE_KEY = "creatorpilot:v1";

export const PIPELINE_STEPS = [
  { id: "transcript", label: "Transcript extracted", agent: "Reference intake" },
  { id: "analyst", label: "Script Analyst", agent: "Structure and retention" },
  { id: "researcher", label: "Research Agent", agent: "Facts and sources" },
  { id: "writer", label: "Scriptwriter", agent: "Original narration" },
  { id: "reviewer", label: "Originality Reviewer", agent: "Similarity review" },
  { id: "producer", label: "Video Producer", agent: "Storyboard and render" },
];

export const STATUS_LABELS = {
  reference_added: "Reference added",
  analyzing: "Analyzing",
  researching: "Researching",
  research_ready: "Research ready",
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

function listValue(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

export function creativeBriefFromProject(project = {}) {
  const brief = project.creativeBrief || {};
  return {
    topic: brief.topic || project.topic || "",
    angle: brief.angle || project.angle || project.topic || "",
    targetAudience: brief.targetAudience || project.targetAudience || "Curious general viewers",
    viewerGoal: brief.viewerGoal || project.viewerGoal || "Understand why this topic matters now",
    desiredTakeaway: brief.desiredTakeaway || project.desiredTakeaway || project.topic || "",
    tone: brief.tone || project.tone || "Clear, informed, conversational",
    language: brief.language || project.language || "Korean",
    mustInclude: listValue(brief.mustInclude ?? project.mustInclude),
    mustAvoid: listValue(brief.mustAvoid ?? project.mustAvoid),
    callToAction: brief.callToAction || project.callToAction || "",
  };
}

export function referenceBlueprintFromAnalysis(analysis = {}) {
  const source = Array.isArray(analysis.structure) ? analysis.structure : [];
  let selected = source.length <= 6
    ? source
    : [source[0], source[1], source[Math.floor(source.length * .4)], source[Math.floor(source.length * .65)], source[Math.floor(source.length * .82)], source[source.length - 1]];
  if (selected.length === 2) {
    const [first, last] = selected;
    const midpoint = Number(last.start) + (Number(last.end) - Number(last.start)) * .55;
    selected = [first, { ...last, end: midpoint }, { ...last, start: midpoint }];
  }
  const structure = selected.map((section, index) => ({
    label: index === 0 ? "Hook" : index === 1 ? "Context" : index === selected.length - 1 ? "Conclusion (Ending)" : section.label,
    start: Number(section.start),
    end: Number(section.end),
    purpose: section.note,
  }));
  return {
    analysisId: analysis.analysisId,
    hookType: analysis.hookType,
    hookPurpose: analysis.hookPurpose,
    tone: analysis.tone,
    pacing: analysis.pacing,
    narrativeEngine: analysis.narrativeStyle?.narrativeEngine || analysis.summary || analysis.pacing,
    informationPattern: analysis.informationFlow?.pattern || analysis.transitions?.[0] || analysis.pacing,
    viewerJourney: analysis.narrativeStyle?.narrativeEngine || analysis.hookPurpose,
    ending: source.length ? source[source.length - 1].note : analysis.callToAction || "Resolve the opening promise with a concise ending.",
    retentionTechniques: (analysis.retentionMap?.map((item) => `${item.type}: ${item.purpose}`) || analysis.retentionTechniques || []).slice(0, 3),
    structure,
  };
}

export function createProject(input = {}) {
  const now = new Date().toISOString();
  const creativeBrief = creativeBriefFromProject(input);
  return {
    id: input.id || `project-${Date.now()}`,
    title: input.topic || "Untitled short",
    referenceUrl: input.referenceUrl || "",
    referenceTitle: input.referenceTitle || "Reference video",
    topic: input.topic || "",
    language: input.language || "Korean",
    duration: Number(input.duration || 60),
    format: input.format || "9:16",
    creativeBrief,
    status: input.status || "reference_added",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    transcript: input.transcript || null,
    analysis: input.analysis || null,
    referenceBlueprint: input.referenceBlueprint || null,
    research: input.research || null,
    generatedScript: input.generatedScript || null,
    pendingRevisionInstructions: input.pendingRevisionInstructions || null,
    originalityReview: input.originalityReview || null,
    storyboard: input.storyboard || [],
    render: input.render || null,
    finalVideoUrl: input.finalVideoUrl || null,
    productionSettings: input.productionSettings || {
      voice: "Sora — Warm documentary",
      captions: "Editorial high contrast",
      music: true,
    },
    pipeline: pipelineState(input.pipeline || {}),
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
        researcher: { status: "completed", detail: "Fact Pack approved" },
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
        researcher: { status: "completed", detail: "Fact Pack approved" },
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
      if (stored?.version === 1 && Array.isArray(stored.projects)) {
        state = { ...stored, projects: stored.projects.map((project) => createProject(project)) };
      }
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

  function deleteProject(id) {
    state.projects = state.projects.filter((project) => project.id !== id);
    if (state.activeProjectId === id) state.activeProjectId = null;
    save();
  }

  function clearProjects() {
    state = { version: 1, projects: [], activeProjectId: null };
    save();
  }

  load();
  return { getState, getProject, addProject, updateProject, deleteProject, clearProjects, load };
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
    research: `#/projects/${projectId}/research`,
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
  const match = path.match(/^\/projects\/([^/]+)\/(analysis|research|script|review|production)$/);
  if (match) return { name: match[2], projectId: match[1] };
  return { name: "not-found" };
}
