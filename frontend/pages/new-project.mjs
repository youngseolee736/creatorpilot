import { escapeHtml } from "../lib/core.mjs";
import { icon, pageHeading } from "../ui/components.mjs";

function referenceRows(draft) {
  return [1, 2, 3, 4, 5].map((position) => {
    const required = position <= 3;
    return `<div class="reference-url-row">
      <div class="reference-url-meta"><span class="reference-number">${String(position).padStart(2, "0")}</span><span class="requirement-label">${required ? "Required" : "Optional"}</span></div>
      <div class="field-group field-span">
        <label for="reference-transcript-${position}">Transcript ${position}</label>
        <textarea class="field-textarea" id="reference-transcript-${position}" name="referenceTranscript${position}" ${required ? "required" : ""} aria-describedby="reference-set-hint" placeholder="Paste the transcript for this reference video here.">${escapeHtml(draft[`referenceTranscript${position}`] || "")}</textarea>
      </div>
    </div>`;
  }).join("");
}

export function renderNewProject(draft = {}, error = null) {
  return `${pageHeading("New production", "Define the story only you should make.", "CreatorPilot compares several reference transcripts, researches your exact angle, then writes from a source-grounded creative brief.")}
    ${error ? `<div class="notice notice-error" role="alert"><strong>Check the project details.</strong><p>${escapeHtml(error)}</p></div>` : ""}
    <form class="reference-form" id="reference-form" novalidate>
      <div class="form-primary">
        <section class="form-section reference-set-section" aria-labelledby="reference-heading">
          <div class="section-index">01</div><div><h2 id="reference-heading">Reference set</h2><p>Paste three reference transcripts. Two more can strengthen the comparison.</p></div>
          <div class="field-span reference-set-fields">
            <div class="reference-set-intro" id="reference-set-hint"><strong>3 required · up to 5 total</strong><span>Each transcript is analyzed separately before CreatorPilot combines the storytelling patterns.</span></div>
            ${referenceRows(draft)}
            <details class="transcript-preview-placeholder"><summary>Reference analysis preview <span>Available after analysis</span></summary><p>Each transcript and story analysis stays attached to its own video. CreatorPilot combines only abstract story mechanics.</p></details>
          </div>
        </section>
        <section class="form-section" aria-labelledby="topic-heading">
          <div class="section-index">02</div><div><h2 id="topic-heading">Original direction</h2><p>Describe the idea the new video should explain.</p></div>
          <div class="field-group field-span"><label for="project-topic">New video topic</label><textarea class="field-textarea" id="project-topic" name="topic" required maxlength="140" placeholder="Why procrastination is not laziness">${escapeHtml(draft.topic || "")}</textarea><span class="field-hint">Be specific enough to guide evidence and visual choices.</span></div>
        </section>
        <section class="form-section" aria-labelledby="tailoring-heading">
          <div class="section-index">03</div><div><h2 id="tailoring-heading">Tailored brief</h2><p>Optional. Leave everything blank and CreatorPilot applies sensible defaults for your topic.</p></div>
          <div class="field-span">
            <details class="brief-options"><summary>Tailor the brief <span>Optional</span></summary>
            <div class="field-group"><label for="project-angle">Specific angle</label><textarea class="field-textarea field-textarea-compact" id="project-angle" name="angle" maxlength="400" placeholder="Explain the psychology behind procrastination and share simple habits to beat it, without sounding preachy.">${escapeHtml(draft.angle || "")}</textarea></div>
            <div class="form-grid">
              <div class="field-group"><label for="target-audience">Target audience</label><input class="field-input" id="target-audience" name="targetAudience" maxlength="400" value="${escapeHtml(draft.targetAudience || "")}" placeholder="University students and young professionals in their 20s" /></div>
              <div class="field-group"><label for="tone">Tone</label><input class="field-input" id="tone" name="tone" maxlength="200" value="${escapeHtml(draft.tone || "Clear, informed, conversational")}" /></div>
            </div>
            <div class="field-group"><label for="viewer-goal">Viewer goal</label><input class="field-input" id="viewer-goal" name="viewerGoal" maxlength="400" value="${escapeHtml(draft.viewerGoal || "")}" placeholder="Understand the issue well enough to explain it to someone else" /></div>
            <div class="field-group"><label for="desired-takeaway">Desired takeaway</label><textarea class="field-textarea field-textarea-compact" id="desired-takeaway" name="desiredTakeaway" maxlength="500" placeholder="Procrastination is an emotional regulation problem, not a time problem — and small habits can fix it.">${escapeHtml(draft.desiredTakeaway || "")}</textarea></div>
            <div class="form-grid">
              <div class="field-group"><label for="must-include">Must include</label><textarea class="field-textarea field-textarea-compact" id="must-include" name="mustInclude" maxlength="1200" placeholder="One item per line">${escapeHtml(draft.mustInclude || "")}</textarea></div>
              <div class="field-group"><label for="must-avoid">Must avoid</label><textarea class="field-textarea field-textarea-compact" id="must-avoid" name="mustAvoid" maxlength="1200" placeholder="Clickbait promises&#10;Unverified statistics">${escapeHtml(draft.mustAvoid || "")}</textarea></div>
            </div>
            <div class="field-group"><label for="call-to-action">Call to action</label><input class="field-input" id="call-to-action" name="callToAction" maxlength="300" value="${escapeHtml(draft.callToAction || "")}" placeholder="Invite viewers to subscribe for more long-form explainers" /></div>
            </details>
          </div>
        </section>
        <section class="form-section" aria-labelledby="output-heading">
          <div class="section-index">04</div><div><h2 id="output-heading">Output</h2><p>These settings stay editable before rendering.</p></div>
          <div class="form-grid field-span">
            <div class="field-group"><label for="language">Target language</label><select class="field-select" id="language" name="language"><option${draft.language !== "English" ? " selected" : ""}>Korean</option><option${draft.language === "English" ? " selected" : ""}>English</option></select></div>
            <div class="field-group"><label for="duration">Target duration</label><div class="field-unit"><input class="field-input" id="duration" name="duration" type="number" min="1" max="7200" value="${escapeHtml(draft.duration || 60)}" /><span>seconds</span></div><span class="field-hint">Any duration from 1 second to 2 hours.</span></div>
            <div class="field-group"><label for="format">Video format</label><select class="field-select" id="format" name="format"><option>9:16</option><option>1:1</option><option>16:9</option></select></div>
          </div>
          <fieldset class="analysis-depth field-span"><legend>Analysis depth</legend>
            <label class="analysis-depth-option"><input type="radio" name="analysisDepth" value="standard"${draft.analysisDepth !== "deep" ? " checked" : ""} /><span><strong>Standard</strong><small>One synthesis model · faster</small></span></label>
            <label class="analysis-depth-option"><input type="radio" name="analysisDepth" value="deep"${draft.analysisDepth === "deep" ? " checked" : ""} /><span><strong>Deep analysis</strong><small>Two independent candidates + final Judge</small></span></label>
          </fieldset>
        </section>
      </div>
      <aside class="form-aside"><div class="ethics-note"><span class="note-mark">CP</span><p class="eyebrow">Tailored by design</p><h2>Structure, facts, and intent stay separate.</h2><p>Script analysis extracts only story mechanics. Research finds current sources for your exact angle. The writing stage receives both, plus your creative decisions.</p><ul><li>${icon("check", 16)}Target audience comes from you, not the reference</li><li>${icon("check", 16)}Claims stay attached to verifiable sources</li><li>${icon("check", 16)}You approve the final script before scene planning</li></ul></div></aside>
      <div class="form-submit"><a class="button button-secondary" href="#/dashboard">Cancel</a><button class="button button-primary" type="submit">Analyze transcripts ${icon("arrow")}</button></div>
    </form>`;
}
