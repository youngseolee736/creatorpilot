import { PIPELINE_STEPS, STATUS_LABELS, escapeHtml, routeFor } from "./core.mjs";
import { serviceConfig } from "./service-client.mjs";

function studioConnectionLabel() {
  const services = serviceConfig.services || {};
  const apiServices = Object.entries(services).filter(([, mode]) => mode === "api").map(([name]) => name);
  if (!apiServices.length) return { mode: "Mock studio", detail: "No AI backend connected" };
  if (services.transcript === "api" && services.analysis === "api") {
    if (services.research === "api" && services.script === "api" && services.review === "api" && services.storyboard === "api" && services.video === "api") {
      return { mode: "Provider studio", detail: "All 7 production services connected" };
    }
    if (services.script === "api" && services.review === "api" && services.storyboard === "api") {
      return { mode: "Hybrid studio", detail: "5 production services connected" };
    }
    if (services.script === "api" && services.review === "api") {
      return { mode: "Hybrid studio", detail: "Transcript + analyst + writer + reviewer connected" };
    }
    if (services.script === "api") {
      return { mode: "Hybrid studio", detail: "Transcript + analyst + scriptwriter connected" };
    }
    return { mode: "Hybrid studio", detail: "Transcript + analyst connected" };
  }
  return { mode: "Hybrid studio", detail: `${apiServices.length} API service${apiServices.length === 1 ? "" : "s"} connected` };
}

export function icon(name, size = 18) {
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    file: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h6"/>',
    spark: '<path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.6 2.9 8.3 7 10 4.1-1.7 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-5"/>',
    retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14H5V6"/><path d="M10 11v6M14 11v6"/>',
  };
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}

export function statusBadge(status) {
  return `<span class="status-badge status-${escapeHtml(status)}"><span aria-hidden="true"></span>${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

const PIPELINE_ROUTES = {
  transcript: "analysis",
  analyst: "analysis",
  researcher: "research",
  writer: "script",
  reviewer: "review",
  producer: "production",
};

function pipelineStepAvailable(project, stepId, currentRoute) {
  if (PIPELINE_ROUTES[stepId] === currentRoute) return true;
  if (["transcript", "analyst"].includes(stepId)) return true;
  if (stepId === "researcher") return Boolean(project.analysis);
  if (stepId === "writer") return Boolean(project.research);
  if (stepId === "reviewer") return Boolean(project.generatedScript);
  if (stepId === "producer") return Boolean(project.originalityReview?.status === "passed" || project.storyboard?.length || project.render);
  return false;
}

export function pipeline(project, { compact = false, currentRoute = "" } = {}) {
  const currentStep = currentRoute === "analysis"
    ? (project.pipeline.transcript?.status === "in_progress" ? "transcript" : "analyst")
    : ({ research: "researcher", script: "writer", review: "reviewer", production: "producer" })[currentRoute];
  return `<ol class="agent-pipeline${compact ? " pipeline-compact" : ""}" aria-label="Production pipeline">
    ${PIPELINE_STEPS.map((step, index) => {
      const state = project.pipeline[step.id] || { status: "waiting", detail: "Waiting" };
      const symbol = state.status === "completed" ? icon("check", 15) : state.status === "in_progress" ? `<span class="pipeline-spinner" aria-hidden="true"></span>` : String(index + 1);
      const destination = PIPELINE_ROUTES[step.id];
      const active = step.id === currentStep;
      const available = pipelineStepAvailable(project, step.id, currentRoute);
      const contents = `<span class="pipeline-marker">${symbol}</span><span class="pipeline-copy"><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(state.detail)}</small></span><span class="sr-only">${escapeHtml(STATUS_LABELS[state.status] || state.status)}</span>`;
      const control = available
        ? `<a class="pipeline-link" href="${routeFor(destination, project.id)}" aria-label="Open ${escapeHtml(step.label)}">${contents}</a>`
        : `<span class="pipeline-link is-disabled" aria-disabled="true" title="Complete the previous stage first">${contents}</span>`;
      return `<li class="pipeline-step pipeline-${escapeHtml(state.status)}${active ? " is-current" : ""}"${active ? ' aria-current="step"' : ""}>${control}</li>`;
    }).join("")}
  </ol>`;
}

export function appShell({ content, route, project = null }) {
  const inWorkspace = Boolean(project);
  const connection = studioConnectionLabel();
  return `<div class="app-frame">
    <a class="skip-link" href="#page-content">Skip to main content</a>
    <aside class="app-sidebar" aria-label="Primary navigation">
      <a class="creator-brand" href="${routeFor("dashboard")}" aria-label="CreatorPilot dashboard">
        <span class="creator-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>CreatorPilot<small>Production studio</small></span>
      </a>
      <nav class="sidebar-nav">
        <a class="${route.name === "dashboard" ? "is-active" : ""}" href="${routeFor("dashboard")}">${icon("dashboard")}<span>Dashboard</span></a>
        <a class="${route.name === "new" ? "is-active" : ""}" href="${routeFor("new")}">${icon("plus")}<span>New project</span></a>
      </nav>
      <div class="sidebar-foot"><span class="mock-dot"></span><span>${escapeHtml(connection.mode)}</span><small>${escapeHtml(connection.detail)}</small></div>
    </aside>
    <div class="app-column">
      <header class="app-topbar">
        <div class="mobile-brand"><span class="creator-mark" aria-hidden="true"><i></i><i></i><i></i></span><strong>CreatorPilot</strong></div>
        <div class="topbar-context">${inWorkspace ? `<a href="${routeFor("dashboard")}">Projects</a><span>/</span><strong>${escapeHtml(project.title)}</strong>` : `<strong>${route.name === "new" ? "New project" : "Creator dashboard"}</strong>`}</div>
        <div class="topbar-meta"><span class="availability-dot"></span>Studio online</div>
      </header>
      <div class="app-body${inWorkspace ? " has-workspace" : ""}">
        ${inWorkspace ? `<aside class="workspace-rail"><a class="back-link" href="${routeFor("dashboard")}">← All projects</a><div class="rail-project"><span>Current production</span><strong>${escapeHtml(project.title)}</strong>${statusBadge(project.status)}</div>${pipeline(project, { currentRoute: route.name })}<button class="rail-delete" type="button" data-action="delete-project">${icon("trash", 14)}Delete project</button></aside>` : ""}
        <main id="page-content" class="page-content" tabindex="-1">${content}</main>
      </div>
    </div>
  </div>`;
}

export function pageHeading(eyebrow, title, description, action = "") {
  return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>${action}</header>`;
}

export function errorNotice(error, retryAction, agentLabel = "Script Analyst") {
  if (!error) return "";
  const titles = {
    LLM_NOT_CONFIGURED: `The ${agentLabel} is not configured.`,
    LLM_TIMEOUT: `The ${agentLabel} took too long.`,
    LLM_RATE_LIMITED: `The ${agentLabel} is temporarily busy.`,
    INVALID_LLM_RESPONSE: "The model response could not be validated.",
    INVALID_RESEARCH_RESPONSE: "The Fact Pack could not be grounded in provider sources.",
    INVALID_RESEARCH_BRIEF: "The tailored research brief is incomplete.",
    TRANSCRIPT_TOO_LARGE: "This transcript is too large to analyze.",
    TRANSCRIPT_NOT_ANALYZABLE: "This transcript cannot be analyzed reliably.",
    LLM_PROVIDER_ERROR: `The ${agentLabel} provider is unavailable.`,
    REVIEW_NOT_FOUND: "The approved review is no longer available on this server.",
    SCRIPT_NOT_APPROVED: "This script does not have a matching passed review.",
    STORYBOARD_NOT_APPROVED: "This storyboard no longer matches the approved script.",
    RENDER_NOT_CONFIGURED: "The render provider is not configured.",
    RENDER_TIMEOUT: "The render provider took too long.",
    RENDER_CAPACITY_LIMITED: "The render provider is currently at capacity.",
    RENDER_PROVIDER_ERROR: "The render provider is unavailable.",
    INVALID_RENDER_RESPONSE: "The render provider returned an invalid response.",
  };
  const title = titles[error.code] || "The agent stopped before completing this stage.";
  const validationReason = error.details?.[0]?.reason;
  const validationHints = {
    duration_inconsistent: "The model's section timeline did not match the reference duration.",
    timeline_inconsistent: "The model returned inconsistent section or hook timing.",
    overlaps_previous_section: "The model returned overlapping analysis sections.",
    contained_by_previous_section: "The model returned a section entirely inside the previous section.",
    long_source_excerpt: "The response included more source wording than the safety contract allows.",
    malformed_json: "The model did not return a complete JSON analysis object.",
    required: "The model omitted one or more required analysis fields.",
    required_string: "A required analysis field was empty or invalid.",
    invalid_array: "A required analysis list or section list was incomplete.",
    must_be_exact_source_excerpt: "The Reviewer proposed evidence that was not an exact excerpt from the submitted text.",
    out_of_range: "The model returned a score outside the accepted range.",
    invalid_enum: "The model returned an unsupported review risk level.",
    must_match_required_claim: "The draft changed the user's required claim instead of answering it directly.",
    must_match_section_plan: "The draft did not follow the selected storytelling structure.",
    insufficient_fact_use: "The draft did not use enough verified facts.",
    insufficient_narrative_case_facts: "The draft did not use enough evidence for the selected narrative case.",
    claim_not_expressed: "The spoken narration did not clearly express the user's claim.",
    script_too_short: "The narration was too short for the requested speaking time.",
    script_too_long: "The narration was too long for the requested speaking time.",
  };
  const message = error.code === "INVALID_LLM_RESPONSE" && validationHints[validationReason]
    ? `${error.message || error} ${validationHints[validationReason]}`
    : error.message || error;
  const action = error.retryable === false
    ? "<small>Update the configuration or reference before trying again.</small>"
    : `<button class="button button-secondary button-small" type="button" data-action="${escapeHtml(retryAction)}">${icon("retry")}Retry</button>`;
  return `<div class="notice notice-error" role="alert" tabindex="-1" id="service-error"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>${action}</div>`;
}

export function loadingPanel(agent, message) {
  return `<section class="loading-panel" aria-live="polite"><span class="agent-orbit" aria-hidden="true"><i></i><i></i></span><p class="eyebrow">${escapeHtml(agent)}</p><h2>${escapeHtml(message)}</h2><p>The project is saved. You can leave this screen and return later.</p><div class="loading-lines" aria-hidden="true"><span></span><span></span><span></span></div></section>`;
}

export function projectFormat(project) {
  return `<dl class="project-facts"><div><dt>Language</dt><dd>${escapeHtml(project.language)}</dd></div><div><dt>Duration</dt><dd>${escapeHtml(project.duration)} sec</dd></div><div><dt>Format</dt><dd>${escapeHtml(project.format)}</dd></div></dl>`;
}
