import { escapeHtml, wordCount } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading } from "../components.mjs";

export function renderScriptEditor(project) {
  if (project.error) return `${pageHeading("Scriptwriter Agent", "Script generation paused.", "Retry without losing the completed reference analysis or current draft.")}${errorNotice(project.error, "retry-script", "Scriptwriter")}`;
  if (!project.generatedScript) {
    return `${pageHeading("Scriptwriter Agent", "Writing for the new topic.", "The reference structure guides pacing, while every sentence is written for this project.")}${loadingPanel("Scriptwriter Agent", "Drafting an original 60-second narration…")}`;
  }
  const script = project.generatedScript;
  const count = wordCount(script);
  return `${pageHeading("Scriptwriter Agent · Draft ready", "Shape the narration before review.", "Edit any section directly. Saved changes remain attached to this project.", `<button class="button button-secondary" type="button" data-action="regenerate-script">${icon("retry")}New version</button>`)}
    <form id="script-form" class="editor-layout">
      <section class="script-workspace">
        <div class="editor-toolbar"><div><span>Draft ${script.version}</span><span id="autosave-state">Auto-saved locally</span></div><div><span><strong id="word-count">${count}</strong> words</span><span><strong>${script.estimatedSeconds}</strong> sec</span></div></div>
        <div class="title-field"><label for="script-title">Video title</label><textarea id="script-title" name="title" rows="4" maxlength="120">${escapeHtml(script.title)}</textarea></div>
        <div class="script-document" aria-label="Full narration, divided into editable script sections">
          <div class="document-heading"><p class="eyebrow">Full narration</p><span>Edit by production section</span></div>
          ${script.sections.map((section, index) => `<section class="script-section" data-section-id="${escapeHtml(section.id)}"><div class="script-section-meta"><span>0${index + 1}</span><div><strong>${escapeHtml(section.label)}</strong><small>${escapeHtml(section.range)}</small></div></div><label class="sr-only" for="section-${escapeHtml(section.id)}">${escapeHtml(section.label)} narration</label><textarea id="section-${escapeHtml(section.id)}" name="section-${escapeHtml(section.id)}" data-script-section rows="${Math.max(2, Math.ceil(section.text.length / 82))}">${escapeHtml(section.text)}</textarea></section>`).join("")}
        </div>
      </section>
      <aside class="editor-aside">
        <section class="editor-score"><p class="eyebrow">Speaking estimate</p><div><strong>${script.estimatedSeconds}s</strong><span>Target ${project.duration}s</span></div><progress max="${project.duration}" value="${script.estimatedSeconds}">${script.estimatedSeconds} seconds</progress><small>Estimated at a clear documentary pace.</small></section>
        <section><p class="eyebrow">Section map</p><nav class="section-nav" aria-label="Script sections">${script.sections.map((section, index) => `<a href="#section-${escapeHtml(section.id)}"><span>0${index + 1}</span>${escapeHtml(section.label)}<small>${escapeHtml(section.range)}</small></a>`).join("")}</nav></section>
        <section class="editor-principle"><p class="eyebrow">Originality guardrail</p><p>The next agent compares potential phrase overlap and structural similarity. It provides an estimate, not legal clearance.</p></section>
      </aside>
      <div class="editor-actions"><button class="button button-secondary" type="button" data-action="save-script">Save changes</button><button class="button button-primary" type="submit">Check originality ${icon("arrow")}</button></div>
    </form>`;
}
