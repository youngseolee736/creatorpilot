import { escapeHtml, formatDate, routeFor } from "../core.mjs";
import { icon, pageHeading, statusBadge } from "../components.mjs";

function destination(project) {
  if (["reference_added", "analyzing"].includes(project.status)) return routeFor("analysis", project.id);
  if (project.status === "script_generated") return routeFor("script", project.id);
  if (["under_review", "revision_required"].includes(project.status)) return routeFor("review", project.id);
  return routeFor("production", project.id);
}

function projectRow(project) {
  return `<div class="project-item" role="listitem">
    <a class="project-row" href="${destination(project)}">
      <span class="project-thumbnail" aria-hidden="true"><span>${escapeHtml(project.format)}</span><i></i></span>
      <span class="project-identity"><strong>${escapeHtml(project.title)}</strong><small>${escapeHtml(project.referenceTitle)}</small></span>
      <span class="project-topic"><small>New topic</small>${escapeHtml(project.topic)}</span>
      <span class="project-stage">${statusBadge(project.status)}</span>
      <span class="project-date"><small>Last edited</small>${formatDate(project.updatedAt)}</span>
      <span class="project-open">${icon("arrow", 18)}</span>
    </a>
    <button class="project-delete" type="button" data-action="delete-project" data-project-id="${escapeHtml(project.id)}" aria-label="Delete ${escapeHtml(project.title)}">${icon("trash", 16)}</button>
  </div>`;
}

export function renderDashboard(state) {
  const projects = [...state.projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const heading = pageHeading(
    "AI multi-agent video studio",
    "Production, without the handoff chaos.",
    "Turn a reference into an original short with every analysis, revision, and scene in one visible workflow.",
    `<a class="button button-primary" href="${routeFor("new")}">${icon("plus")}Create new video</a>`,
  );
  if (!projects.length) {
    return `${heading}<section class="empty-state"><div class="empty-visual" aria-hidden="true"><span>01</span><span>02</span><span>03</span><i></i></div><p class="eyebrow">Your studio is clear</p><h2>Create your first production.</h2><p>Add a reference YouTube video and a new topic. CreatorPilot will map the storytelling structure, draft an original script, review it, and plan the final scenes.</p><a class="button button-primary" href="${routeFor("new")}">${icon("plus")}Create new video</a></section>`;
  }
  return `${heading}
    <section class="dashboard-summary" aria-label="Project summary">
      <div><span>Active productions</span><strong>${projects.filter((project) => project.status !== "completed").length}</strong><small>Across analysis, review, and render</small></div>
      <div><span>Ready videos</span><strong>${projects.filter((project) => project.status === "completed").length}</strong><small>Mock renders completed</small></div>
      <div class="summary-note"><span>Studio model</span><strong>4 collaborating agents</strong><small>Plus transcript extraction</small></div>
    </section>
    <section class="project-list-section"><div class="section-bar"><div><p class="eyebrow">Workspace</p><h2>Recent projects</h2></div><span>${projects.length} project${projects.length === 1 ? "" : "s"}</span></div><div class="project-list" role="list">${projects.map(projectRow).join("")}</div></section>`;
}
