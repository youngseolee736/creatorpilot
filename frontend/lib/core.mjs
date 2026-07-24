export const STORAGE_KEY = "creatorpilot:v2";

export const PIPELINE_STEPS = [
  { id: "transcript", label: "References prepared", agent: "Reference intake" },
  { id: "analyst", label: "Script Analyst", agent: "Structure and retention" },
  { id: "researcher", label: "Research Agent", agent: "Facts and sources" },
  { id: "writer", label: "Scriptwriter", agent: "Original narration" },
  { id: "producer", label: "Storyboard Preview", agent: "Scene planning" },
];

export const STATUS_LABELS = {
  reference_added: "References ready",
  analyzing: "Analyzing",
  researching: "Researching",
  research_ready: "Research ready",
  script_generated: "Script generated",
  under_review: "Storyboard ready",
  revision_required: "Revision required",
  completed: "Completed",
  waiting: "Waiting",
  in_progress: "In progress",
  failed: "Failed",
  passed: "Passed",
};

export function referenceTitleFromTranscript(transcript, fallback = "Reference video") {
  return String(transcript?.title || "").trim() || fallback;
}

export function manualTranscriptFromText({ projectId, referenceId, title, language, text, estimatedDuration }) {
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  const wordCount = normalizedText ? normalizedText.split(/\s+/).filter(Boolean).length : 0;
  return {
    transcriptId: `tr_manual_${projectId}_${referenceId}`,
    source: "manual",
    title: String(title || "").trim() || "Manual transcript",
    text: normalizedText,
    language: language || null,
    wordCount,
    estimatedDuration: Number(estimatedDuration) || null,
    segments: [],
  };
}

export function youtubeVideoId(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || null;
    if (host !== "youtube.com" && host !== "m.youtube.com") return null;
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    return ["shorts", "embed", "live"].includes(parts[0]) ? parts[1] || null : null;
  } catch {
    return null;
  }
}

export function normalizeReferences(input = {}) {
  const supplied = Array.isArray(input.references)
    ? input.references
    : [1, 2, 3, 4, 5]
      .map((position) => ({
        url: input[`referenceUrl${position}`],
        title: input[`referenceTitle${position}`],
        transcriptText: input[`referenceTranscript${position}`],
        position,
      }))
      .filter((reference) => {
        const url = typeof reference.url === "string" && reference.url.trim();
        const transcriptText = typeof reference.transcriptText === "string" && reference.transcriptText.trim();
        const title = typeof reference.title === "string" && reference.title.trim();
        return Boolean(url || transcriptText || title);
      });
  const legacy = supplied.length ? supplied : input.referenceUrl
    ? [{
      url: input.referenceUrl,
      title: input.referenceTitle,
      transcript: input.transcript,
      analysis: input.referenceAnalysis || (input.analysis?.referenceCount ? null : input.analysis),
      position: 1,
    }]
    : [];
  return legacy.slice(0, 5).map((reference, index) => ({
    referenceId: reference.referenceId || `reference-${index + 1}`,
    position: index + 1,
    required: index < 3,
    url: String(reference.url || "").trim(),
    title: reference.title || reference.transcript?.title || `Reference ${index + 1}`,
    transcript: reference.transcript || null,
    transcriptText: typeof reference.transcriptText === "string" ? reference.transcriptText : "",
    analysis: reference.analysis || null,
  }));
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
  const projectId = input.id || `project-${Date.now()}`;
  const creativeBrief = creativeBriefFromProject(input);
  const references = normalizeReferences(input).map((reference) => {
    if (reference.transcript) return reference;
    if (!reference.transcriptText?.trim()) return reference;
    return {
      ...reference,
      transcript: manualTranscriptFromText({
        projectId,
        referenceId: reference.referenceId,
        title: reference.title,
        language: input.language || "Korean",
        text: reference.transcriptText,
        estimatedDuration: Number(input.duration || 60),
      }),
    };
  });
  const firstReference = references[0] || null;
  return {
    id: projectId,
    title: input.topic || "Untitled short",
    references,
    referenceUrl: firstReference?.url || input.referenceUrl || "",
    referenceTitle: firstReference?.title || input.referenceTitle || "Reference video",
    topic: input.topic || "",
    language: input.language || "Korean",
    duration: Number(input.duration || 60),
    format: input.format || "9:16",
    analysisDepth: input.analysisDepth === "deep" ? "deep" : "standard",
    creativeBrief,
    status: input.status || "reference_added",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    transcript: firstReference?.transcript || input.transcript || null,
    analysis: input.analysis || null,
    referenceBlueprint: input.referenceBlueprint || null,
    research: input.research || null,
    generatedScript: input.generatedScript || null,
    pendingRevisionInstructions: input.pendingRevisionInstructions || null,
    storyboard: input.storyboard || [],
    render: null,
    pipeline: pipelineState(input.pipeline || {}),
    error: null,
  };
}

function initialState() {
  return { version: 1, projects: [], activeProjectId: null };
}

function stateForStorage(value) {
  return JSON.parse(JSON.stringify(value, (key, fieldValue) => (
    key === "imageDataUrl" || key === "imageUrl" ? undefined : fieldValue
  )));
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
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(stateForStorage(state)));
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
    production: `#/projects/${projectId}/production`,
  };
  return routes[name] || routes.dashboard;
}

export function parseRoute(hash = globalThis.location?.hash || "") {
  const path = hash.replace(/^#/, "") || "/dashboard";
  if (path === "/dashboard") return { name: "dashboard" };
  if (path === "/projects/new") return { name: "new" };
  const match = path.match(/^\/projects\/([^/]+)\/(analysis|research|script|production)$/);
  if (match) return { name: match[2], projectId: match[1] };
  return { name: "not-found" };
}
