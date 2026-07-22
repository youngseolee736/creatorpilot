import { escapeHtml } from "../core.mjs";
import { icon, pageHeading } from "../components.mjs";

export function renderNewProject(draft = {}, error = null) {
  return `${pageHeading("New production", "Define the story only you should make.", "CreatorPilot studies a reference's storytelling mechanics, researches your exact angle, then writes from a source-grounded creative brief.")}
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
          <div class="field-group field-span"><label for="project-topic">New video topic</label><textarea class="field-textarea" id="project-topic" name="topic" required maxlength="140" placeholder="Why procrastination is not laziness">${escapeHtml(draft.topic || "")}</textarea><span class="field-hint">Be specific enough to guide evidence and visual choices.</span></div>
        </section>
        <section class="form-section" aria-labelledby="tailoring-heading">
          <div class="section-index">03</div><div><h2 id="tailoring-heading">Tailored brief</h2><p>Tell the Research Agent who this is for and what the story must accomplish.</p></div>
          <div class="field-span">
            <div class="field-group"><label for="project-angle">Specific angle</label><textarea class="field-textarea field-textarea-compact" id="project-angle" name="angle" required maxlength="400" placeholder="Explain the psychology behind procrastination and share simple habits to beat it, without sounding preachy.">${escapeHtml(draft.angle || "")}</textarea></div>
            <div class="form-grid">
              <div class="field-group"><label for="target-audience">Target audience</label><input class="field-input" id="target-audience" name="targetAudience" required maxlength="400" value="${escapeHtml(draft.targetAudience || "")}" placeholder="University students and young professionals in their 20s" /></div>
              <div class="field-group"><label for="tone">Tone</label><input class="field-input" id="tone" name="tone" required maxlength="200" value="${escapeHtml(draft.tone || "Clear, informed, conversational")}" /></div>
            </div>
            <div class="field-group"><label for="viewer-goal">Viewer goal</label><input class="field-input" id="viewer-goal" name="viewerGoal" required maxlength="400" value="${escapeHtml(draft.viewerGoal || "")}" placeholder="Understand the issue well enough to explain it to someone else" /></div>
            <div class="field-group"><label for="desired-takeaway">Desired takeaway</label><textarea class="field-textarea field-textarea-compact" id="desired-takeaway" name="desiredTakeaway" required maxlength="500" placeholder="Procrastination is an emotional regulation problem, not a time problem — and small habits can fix it.">${escapeHtml(draft.desiredTakeaway || "")}</textarea></div>
            <details class="brief-options"><summary>Editorial guardrails <span>Optional</span></summary>
              <div class="form-grid">
                <div class="field-group"><label for="must-include">Must include</label><textarea class="field-textarea field-textarea-compact" id="must-include" name="mustInclude" maxlength="1200" placeholder="One item per line">${escapeHtml(draft.mustInclude || "")}</textarea></div>
                <div class="field-group"><label for="must-avoid">Must avoid</label><textarea class="field-textarea field-textarea-compact" id="must-avoid" name="mustAvoid" maxlength="1200" placeholder="Partisan framing&#10;Unverified casualty estimates">${escapeHtml(draft.mustAvoid || "")}</textarea></div>
              </div>
              <div class="field-group"><label for="call-to-action">Call to action</label><input class="field-input" id="call-to-action" name="callToAction" maxlength="300" value="${escapeHtml(draft.callToAction || "")}" placeholder="Invite viewers to follow for more one-minute explainers" /></div>
            </details>
          </div>
        </section>
        <section class="form-section" aria-labelledby="output-heading">
          <div class="section-index">04</div><div><h2 id="output-heading">Output</h2><p>These settings stay editable before rendering.</p></div>
          <div class="form-grid field-span">
            <div class="field-group"><label for="language">Target language</label><select class="field-select" id="language" name="language"><option${draft.language !== "English" ? " selected" : ""}>Korean</option><option${draft.language === "English" ? " selected" : ""}>English</option></select></div>
            <div class="field-group"><label for="duration">Target duration</label><div class="field-unit"><input class="field-input" id="duration" name="duration" type="number" min="15" max="180" value="${escapeHtml(draft.duration || 60)}" /><span>seconds</span></div></div>
            <div class="field-group"><label for="format">Video format</label><select class="field-select" id="format" name="format"><option>9:16</option><option>1:1</option><option>16:9</option></select></div>
          </div>
        </section>
      </div>
      <aside class="form-aside"><div class="ethics-note"><span class="note-mark">CP</span><p class="eyebrow">Tailored by design</p><h2>Structure, facts, and intent stay separate.</h2><p>The Analyst extracts only story mechanics. The Research Agent finds current sources for your exact angle. The Scriptwriter receives both, plus your creative decisions.</p><ul><li>${icon("check", 16)}Target audience comes from you, not the reference</li><li>${icon("check", 16)}Claims stay attached to reviewable sources</li><li>${icon("check", 16)}The final draft still receives similarity review</li></ul></div></aside>
      <div class="form-submit"><a class="button button-secondary" href="#/dashboard">Cancel</a><button class="button button-primary" type="submit">Analyze reference ${icon("arrow")}</button></div>
    </form>`;
}
