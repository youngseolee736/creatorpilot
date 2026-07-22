import { PIPELINE_STEPS, escapeHtml, formatDate, routeFor } from "../core.mjs";
import { icon, pageHeading, statusBadge } from "../components.mjs";

const FLOW_ROLES = {
  transcript: ["Reference intake", "Transcripts and timing in"],
  analyst: ["Script Analyst", "Extracts hook, pacing, structure"],
  researcher: ["Research Agent", "Grounds the angle in sources"],
  writer: ["Scriptwriter", "Writes original narration only"],
  reviewer: ["Originality Reviewer", "Flags overlap before approval"],
  producer: ["Video Producer", "Storyboard, then render"],
};

function studioFlow() {
  return `<section class="studio-flow" aria-label="How CreatorPilot works">
    <p>Six agents, one visible workflow</p>
    <ol>${PIPELINE_STEPS.map((step, index) => {
      const [name, role] = FLOW_ROLES[step.id];
      return `<li><span class="flow-marker" aria-hidden="true">${index + 1}</span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role)}</small></li>`;
    }).join("")}</ol>
  </section>`;
}

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
    "YouTube script studio",
    "Watch a reference become your script.",
    "Paste reference links and a topic. Each agent below handles one stage — structure, facts, writing, review, and scenes — in the open, not in a chat box.",
    `<a class="button button-primary" href="${routeFor("new")}">${icon("plus")}Create new video</a>`,
  );
  if (!projects.length) {
    return `${heading}${studioFlow()}<section class="empty-state"><div class="empty-visual" aria-hidden="true"><span>01</span><span>02</span><span>03</span><i></i></div><p class="eyebrow">Your studio is clear</p><h2>Create your first production.</h2><p>Add three to five reference videos and a new topic. CreatorPilot will compare their storytelling logic, draft an original script, review it, and plan the final scenes.</p><a class="button button-primary" href="${routeFor("new")}">${icon("plus")}Create new video</a></section>`;
  }
  return `${heading}${studioFlow()}
    <section class="dashboard-summary" aria-label="Project summary">
      <div><span>Active productions</span><strong>${projects.filter((project) => project.status !== "completed").length}</strong><small>Across analysis, review, and render</small></div>
      <div><span>Ready videos</span><strong>${projects.filter((project) => project.status === "completed").length}</strong><small>Mock renders completed</small></div>
      <div class="summary-note"><span>Studio model</span><strong>6-stage agent pipeline</strong><small>Structure, facts, writing, review, scenes</small></div>
    </section>
    <section class="project-list-section"><div class="section-bar"><div><p class="eyebrow">Workspace</p><h2>Recent projects</h2></div><span>${projects.length} project${projects.length === 1 ? "" : "s"}</span></div><div class="project-list" role="list">${projects.map(projectRow).join("")}</div></section>`;
}
