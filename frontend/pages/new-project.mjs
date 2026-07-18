import { escapeHtml } from "../core.mjs";
import { icon, pageHeading } from "../components.mjs";

export function renderNewProject(draft = {}, error = null) {
  return `${pageHeading("New production", "Add the creative starting point.", "CreatorPilot studies storytelling structure, then builds a new script for your topic. It does not copy the original creator's wording.")}
    ${error ? `<div class="notice notice-error" role="alert"><strong>Check the project details.</strong><p>${escapeHtml(error)}</p></div>` : ""}
    <form class="reference-form" id="reference-form" novalidate>
      <div class="form-primary">
        <section class="form-section" aria-labelledby="reference-heading">
          <div class="section-index">01</div><div><h2 id="reference-heading">Reference</h2><p>Use a public YouTube URL for this frontend demonstration.</p></div>
          <div class="field-group field-span">
            <label for="reference-url">YouTube URL</label><span class="field-hint" id="url-hint">For example, https://www.youtube.com/watch?v=...</span>
            <input class="field-input" id="reference-url" name="referenceUrl" type="url" inputmode="url" autocomplete="url" required aria-describedby="url-hint" value="${escapeHtml(draft.referenceUrl || "")}" placeholder="https://youtube.com/watch?v=..." />
            <details class="transcript-preview-placeholder"><summary>Transcript preview <span>Available after analysis</span></summary><p>CreatorPilot will display the extracted transcript here before the Scriptwriter begins. This frontend demonstration uses clearly labeled mock transcript data.</p></details>
          </div>
        </section>
        <section class="form-section" aria-labelledby="topic-heading">
          <div class="section-index">02</div><div><h2 id="topic-heading">Original direction</h2><p>Describe the idea the new 60-second video should explain.</p></div>
          <div class="field-group field-span"><label for="project-topic">New video topic</label><textarea class="field-textarea" id="project-topic" name="topic" required maxlength="140" placeholder="Why the United States cannot abandon Taiwan">${escapeHtml(draft.topic || "")}</textarea><span class="field-hint">Be specific enough to guide evidence and visual choices.</span></div>
        </section>
        <section class="form-section" aria-labelledby="output-heading">
          <div class="section-index">03</div><div><h2 id="output-heading">Output</h2><p>These settings stay editable before rendering.</p></div>
          <div class="form-grid field-span">
            <div class="field-group"><label for="language">Target language</label><select class="field-select" id="language" name="language"><option${draft.language !== "English" ? " selected" : ""}>Korean</option><option${draft.language === "English" ? " selected" : ""}>English</option></select></div>
            <div class="field-group"><label for="duration">Target duration</label><div class="field-unit"><input class="field-input" id="duration" name="duration" type="number" min="15" max="180" value="${escapeHtml(draft.duration || 60)}" /><span>seconds</span></div></div>
            <div class="field-group"><label for="format">Video format</label><select class="field-select" id="format" name="format"><option>9:16</option><option>1:1</option><option>16:9</option></select></div>
          </div>
        </section>
      </div>
      <aside class="form-aside"><div class="ethics-note"><span class="note-mark">CP</span><p class="eyebrow">Originality by design</p><h2>Structure is a reference, not a template.</h2><p>The analyst identifies pacing, hook mechanics, and audience strategy. The Scriptwriter creates new language for your topic, and the Reviewer flags potential phrase overlap before production.</p><ul><li>${icon("check", 16)}No source wording is intentionally reused</li><li>${icon("check", 16)}Every draft receives a similarity review</li><li>${icon("check", 16)}You approve the script before video production</li></ul></div></aside>
      <div class="form-submit"><a class="button button-secondary" href="#/dashboard">Cancel</a><button class="button button-primary" type="submit">Analyze reference ${icon("arrow")}</button></div>
    </form>`;
}
