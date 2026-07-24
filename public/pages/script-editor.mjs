import { escapeHtml, routeFor, wordCount } from "../lib/core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading } from "../ui/components.mjs";

export function renderScriptEditor(project) {
  const backToResearch = `<a class="button button-secondary" href="${routeFor("research", project.id)}">← Back to research</a>`;
  if (project.error) return `${pageHeading("Writing Stage", "Script generation paused.", "Retry without losing the completed reference analysis or current draft.", backToResearch)}${errorNotice(project.error, "retry-script", "Writing stage")}`;
  if (!project.generatedScript) {
    return `${pageHeading("Writing Stage", "Building the case.", "The reference logic shapes the story while verified findings support the claim.", backToResearch)}${loadingPanel("Writing Stage", "Turning verified findings into a full-duration, claim-led narration. This can take a few minutes. Keep this tab open.")}`;
  }
  const script = project.generatedScript;
  const count = wordCount(script);
  const strategyLabels = { direct_case: "Direct case", reframed_case: "Narrative case", evidence_boundary: "Evidence boundary", argue: "Direct case", qualify: "Narrative case", challenge: "Evidence boundary" };
  const strategy = script.claimStrategy || { mode: "reframed_case", explanation: "The draft makes the strongest evidence-backed case available." };
  const ensemble = script.ensemble;
  return `${pageHeading("Script Draft · Ready", "Build the case, then land the claim.", "Edit any section directly. Every marked finding comes from the completed research.", `<div class="button-row"><a class="button button-secondary" href="${routeFor("research", project.id)}">← Back to research</a><button class="button button-secondary" type="button" data-action="regenerate-script">${icon("retry")}New version</button></div>`)}
    <form id="script-form" class="editor-layout">
      <section class="script-workspace">
        <div class="editor-toolbar"><div><span>Draft ${script.version}</span><span id="autosave-state">Auto-saved locally</span></div><div><span><strong id="word-count">${count}</strong> words</span><span><strong>${script.estimatedSeconds}</strong> sec</span></div></div>
        <div class="title-field"><label for="script-title">Video title</label><textarea id="script-title" name="title" rows="4" maxlength="120">${escapeHtml(script.title)}</textarea></div>
        ${ensemble?.mode === "deep" ? `<section class="ensemble-disclosure script-ensemble"><details><summary><span><strong>How the writing models compared</strong><small>Deep analysis · ${Math.round((ensemble.judgment?.confidence || 0) * 100)}% confidence</small></span>${icon("arrow", 16)}</summary><div class="ensemble-candidates">${(ensemble.candidates || []).map((candidate) => `<article><p>${escapeHtml(candidate.focus)}</p><h3>${escapeHtml(candidate.id === "candidate-a" ? "Writing Candidate A" : "Writing Candidate B")}</h3><span>${escapeHtml(candidate.summary)}</span></article>`).join("")}</div><div class="ensemble-decision"><p class="eyebrow">Writing Judge</p><strong>${escapeHtml(ensemble.judgment?.winner === "hybrid" ? "Combined final draft" : "Best available draft")}</strong><p>${escapeHtml(ensemble.judgment?.reason || "The strongest validated draft was selected.")}</p>${ensemble.degraded ? `<small>One role was unavailable, so CreatorPilot continued with a completed validated draft.</small>` : ""}</div></details></section>` : ""}
        <div class="script-document" aria-label="Full narration, divided into editable paragraphs">
          <div class="document-heading"><p class="eyebrow">Full narration</p><span>Read and edit one paragraph at a time</span></div>
          ${script.sections.map((section, index) => `<section class="script-section script-paragraph" data-section-id="${escapeHtml(section.id)}"><header class="script-paragraph-header"><div class="paragraph-identity"><span>Paragraph ${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(section.label)}</strong></div><div class="paragraph-details"><small>${escapeHtml(section.range)}</small>${section.factIds?.length ? `<small class="section-facts">${section.factIds.map((factId) => escapeHtml(factId.replace("fact_", "Fact "))).join(" · ")}</small>` : ""}</div></header><label class="sr-only" for="section-${escapeHtml(section.id)}">${escapeHtml(section.label)} paragraph</label><textarea id="section-${escapeHtml(section.id)}" name="section-${escapeHtml(section.id)}" data-script-section rows="${Math.max(3, Math.ceil(section.text.length / 56))}">${escapeHtml(section.text)}</textarea></section>`).join("")}
        </div>
      </section>
      <aside class="editor-aside">
        <section class="claim-lock"><div><p class="eyebrow">Claim lock</p><span class="claim-mode">${escapeHtml(strategyLabels[strategy.mode] || "Evidence-led")}</span></div><h2>${escapeHtml(script.claim || project.topic)}</h2>${strategy.frame ? `<blockquote>${escapeHtml(strategy.frame)}</blockquote>` : ""}<p>${escapeHtml(strategy.explanation)}</p><small>${script.usedFactIds?.length || 0} research findings used</small></section>
        <section class="editor-score"><p class="eyebrow">Speaking estimate</p><div><strong>${script.estimatedSeconds}s</strong><span>Target ${project.duration}s</span></div><progress max="${project.duration}" value="${script.estimatedSeconds}">${script.estimatedSeconds} seconds</progress><small>Estimated at a clear documentary pace.</small></section>
        <section><p class="eyebrow">Section map</p><nav class="section-nav" aria-label="Script sections">${script.sections.map((section, index) => `<a href="#section-${escapeHtml(section.id)}"><span>0${index + 1}</span>${escapeHtml(section.label)}<small>${escapeHtml(section.range)}</small></a>`).join("")}</nav></section>
        <section class="editor-principle"><p class="eyebrow">Next step</p><p>Approve the edited narration to generate a timed visual storyboard.</p></section>
      </aside>
      <div class="editor-actions"><button class="button button-secondary" type="button" data-action="save-script">Save changes</button><button class="button button-primary" type="button" data-action="approve-production">Create storyboard ${icon("arrow")}</button></div>
    </form>`;
}
