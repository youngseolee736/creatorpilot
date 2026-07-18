import { PIPELINE_STEPS, STATUS_LABELS, escapeHtml, routeFor } from "./core.mjs";
import { serviceConfig } from "./service-client.mjs";

function studioConnectionLabel() {
  const services = serviceConfig.services || {};
  const apiServices = Object.entries(services).filter(([, mode]) => mode === "api").map(([name]) => name);
  if (!apiServices.length) return { mode: "Mock studio", detail: "No AI backend connected" };
  if (services.transcript === "api" && services.analysis === "api") {
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
    retry: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
  };
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}

export function statusBadge(status) {
  return `<span class="status-badge status-${escapeHtml(status)}"><span aria-hidden="true"></span>${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

export function pipeline(project, { compact = false } = {}) {
  return `<ol class="agent-pipeline${compact ? " pipeline-compact" : ""}" aria-label="Production pipeline">
    ${PIPELINE_STEPS.map((step, index) => {
      const state = project.pipeline[step.id] || { status: "waiting", detail: "Waiting" };
      const symbol = state.status === "completed" ? icon("check", 15) : state.status === "in_progress" ? `<span class="pipeline-spinner" aria-hidden="true"></span>` : String(index + 1);
      return `<li class="pipeline-step pipeline-${escapeHtml(state.status)}" aria-current="${state.status === "in_progress" ? "step" : "false"}">
        <span class="pipeline-marker">${symbol}</span>
        <span class="pipeline-copy"><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(state.detail)}</small></span>
        <span class="sr-only">${escapeHtml(STATUS_LABELS[state.status] || state.status)}</span>
      </li>`;
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
        ${inWorkspace ? `<aside class="workspace-rail"><a class="back-link" href="${routeFor("dashboard")}">← All projects</a><div class="rail-project"><span>Current production</span><strong>${escapeHtml(project.title)}</strong>${statusBadge(project.status)}</div>${pipeline(project)}</aside>` : ""}
        <main id="page-content" class="page-content" tabindex="-1">${content}</main>
      </div>
    </div>
  </div>`;
}

export function pageHeading(eyebrow, title, description, action = "") {
  return `<header class="page-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>${action}</header>`;
}

export function errorNotice(error, retryAction) {
  if (!error) return "";
  const titles = {
    LLM_NOT_CONFIGURED: "The Script Analyst is not configured.",
    LLM_TIMEOUT: "The analysis took too long.",
    LLM_RATE_LIMITED: "The Script Analyst is temporarily busy.",
    INVALID_LLM_RESPONSE: "The model response could not be validated.",
    TRANSCRIPT_TOO_LARGE: "This transcript is too large to analyze.",
    TRANSCRIPT_NOT_ANALYZABLE: "This transcript cannot be analyzed reliably.",
    LLM_PROVIDER_ERROR: "The Script Analyst provider is unavailable.",
  };
  const title = titles[error.code] || "The agent stopped before completing this stage.";
  const action = error.retryable === false
    ? "<small>Update the configuration or reference before trying again.</small>"
    : `<button class="button button-secondary button-small" type="button" data-action="${escapeHtml(retryAction)}">${icon("retry")}Retry</button>`;
  return `<div class="notice notice-error" role="alert" tabindex="-1" id="service-error"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(error.message || error)}</p></div>${action}</div>`;
}

export function loadingPanel(agent, message) {
  return `<section class="loading-panel" aria-live="polite"><span class="agent-orbit" aria-hidden="true"><i></i><i></i></span><p class="eyebrow">${escapeHtml(agent)}</p><h2>${escapeHtml(message)}</h2><p>The project is saved. You can leave this screen and return later.</p><div class="loading-lines" aria-hidden="true"><span></span><span></span><span></span></div></section>`;
}

export function projectFormat(project) {
  return `<dl class="project-facts"><div><dt>Language</dt><dd>${escapeHtml(project.language)}</dd></div><div><dt>Duration</dt><dd>${escapeHtml(project.duration)} sec</dd></div><div><dt>Format</dt><dd>${escapeHtml(project.format)}</dd></div></dl>`;
}
