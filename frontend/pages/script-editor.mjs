import { escapeHtml, routeFor, wordCount } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading } from "../components.mjs";

export function renderScriptEditor(project) {
  if (project.error) return `${pageHeading("Scriptwriter Agent", "Script generation paused.", "Retry without losing the completed reference analysis or current draft.")}${errorNotice(project.error, "retry-script", "Scriptwriter")}`;
  if (!project.generatedScript) {
    return `${pageHeading("Scriptwriter Agent", "Building the case.", "The reference logic shapes the story while verified findings support the claim.")}${loadingPanel("Scriptwriter Agent", "Turning verified findings into a claim-led narration…")}`;
  }
  const script = project.generatedScript;
  const count = wordCount(script);
  const strategyLabels = { direct_case: "Direct case", reframed_case: "Narrative case", evidence_boundary: "Evidence boundary", argue: "Direct case", qualify: "Narrative case", challenge: "Evidence boundary" };
  const strategy = script.claimStrategy || { mode: "reframed_case", explanation: "The draft makes the strongest evidence-backed case available." };
  return `${pageHeading("Scriptwriter Agent · Draft ready", "Build the case, then land the claim.", "Edit any section directly. Every marked finding comes from the completed research.", `<div class="button-row"><a class="button button-secondary" href="${routeFor("research", project.id)}">← Back to research</a><button class="button button-secondary" type="button" data-action="regenerate-script">${icon("retry")}New version</button></div>`)}
    <form id="script-form" class="editor-layout">
      <section class="script-workspace">
        <div class="editor-toolbar"><div><span>Draft ${script.version}</span><span id="autosave-state">Auto-saved locally</span></div><div><span><strong id="word-count">${count}</strong> words</span><span><strong>${script.estimatedSeconds}</strong> sec</span></div></div>
        <div class="title-field"><label for="script-title">Video title</label><textarea id="script-title" name="title" rows="4" maxlength="120">${escapeHtml(script.title)}</textarea></div>
        <div class="script-document" aria-label="Full narration, divided into editable script sections">
          <div class="document-heading"><p class="eyebrow">Full narration</p><span>Edit by production section</span></div>
          ${script.sections.map((section, index) => `<section class="script-section" data-section-id="${escapeHtml(section.id)}"><div class="script-section-meta"><span>0${index + 1}</span><div><strong>${escapeHtml(section.label)}</strong><small>${escapeHtml(section.range)}</small>${section.factIds?.length ? `<small class="section-facts">${section.factIds.map((factId) => escapeHtml(factId.replace("fact_", "Fact "))).join(" · ")}</small>` : ""}</div></div><label class="sr-only" for="section-${escapeHtml(section.id)}">${escapeHtml(section.label)} narration</label><textarea id="section-${escapeHtml(section.id)}" name="section-${escapeHtml(section.id)}" data-script-section rows="${Math.max(2, Math.ceil(section.text.length / 82))}">${escapeHtml(section.text)}</textarea></section>`).join("")}
        </div>
      </section>
      <aside class="editor-aside">
        <section class="claim-lock"><div><p class="eyebrow">Claim lock</p><span class="claim-mode">${escapeHtml(strategyLabels[strategy.mode] || "Evidence-led")}</span></div><h2>${escapeHtml(script.claim || project.topic)}</h2>${strategy.frame ? `<blockquote>${escapeHtml(strategy.frame)}</blockquote>` : ""}<p>${escapeHtml(strategy.explanation)}</p><small>${script.usedFactIds?.length || 0} research findings used</small></section>
        <section class="editor-score"><p class="eyebrow">Speaking estimate</p><div><strong>${script.estimatedSeconds}s</strong><span>Target ${project.duration}s</span></div><progress max="${project.duration}" value="${script.estimatedSeconds}">${script.estimatedSeconds} seconds</progress><small>Estimated at a clear documentary pace.</small></section>
        <section><p class="eyebrow">Section map</p><nav class="section-nav" aria-label="Script sections">${script.sections.map((section, index) => `<a href="#section-${escapeHtml(section.id)}"><span>0${index + 1}</span>${escapeHtml(section.label)}<small>${escapeHtml(section.range)}</small></a>`).join("")}</nav></section>
        <section class="editor-principle"><p class="eyebrow">Originality guardrail</p><p>The next agent compares potential phrase overlap and structural similarity. It provides an estimate, not legal clearance.</p></section>
      </aside>
      <div class="editor-actions"><button class="button button-secondary" type="button" data-action="save-script">Save changes</button><button class="button button-primary" type="submit">Check originality ${icon("arrow")}</button></div>
    </form>`;
}
