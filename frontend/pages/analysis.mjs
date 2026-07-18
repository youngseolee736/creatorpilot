import { escapeHtml, formatTime } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading, projectFormat } from "../components.mjs";

export function renderAnalysis(project) {
  if (project.error) return `${pageHeading("Script Analyst Agent", "Reference analysis paused.", "The project remains saved and can be retried without starting over.")}${errorNotice(project.error, "retry-analysis")}`;
  if (!project.analysis) {
    const message = project.transcript ? "Mapping the storytelling structure…" : "Extracting the reference transcript…";
    return `${pageHeading("Script Analyst Agent", "Reading the reference like an editor.", "Hook, pacing, audience, and retention techniques are analyzed before any new writing begins.")}${loadingPanel(project.transcript ? "Script Analyst Agent" : "Transcript extraction", message)}`;
  }
  const analysis = project.analysis;
  return `${pageHeading("Script Analyst Agent · Complete", "The structure behind the story.", "The analysis captures production mechanics, not source wording.", `<button class="button button-primary" type="button" data-action="generate-script">Generate original script ${icon("arrow")}</button>`)}
    <div class="analysis-layout">
      <section class="analysis-main">
        <div class="analysis-overview">
          <div><span>Hook type</span><strong>${escapeHtml(analysis.hookType)}</strong><small>${analysis.hookDuration} seconds</small></div>
          <div><span>Target audience</span><strong>${escapeHtml(analysis.targetAudience)}</strong></div>
          <div><span>Tone</span><strong>${escapeHtml(analysis.tone)}</strong></div>
          <div><span>Pacing</span><strong>${escapeHtml(analysis.pacing)}</strong></div>
        </div>
        <section class="timeline-section"><div class="section-bar"><div><p class="eyebrow">60-second anatomy</p><h2>Story structure</h2></div><span>${formatTime(analysis.estimatedOriginalDuration)}</span></div>
          <ol class="structure-timeline">${analysis.structure.map((segment, index) => `<li style="--segment:${segment.end - segment.start}"><div class="segment-time"><span>${segment.start}s</span><i></i><span>${segment.end}s</span></div><div><small>0${index + 1}</small><strong>${escapeHtml(segment.label)}</strong><p>${escapeHtml(segment.note)}</p></div></li>`).join("")}</ol>
        </section>
      </section>
      <aside class="analysis-aside">
        <section><p class="eyebrow">Retention techniques</p><ul class="technique-list">${analysis.retentionTechniques.map((item) => `<li>${icon("spark", 16)}${escapeHtml(item)}</li>`).join("")}</ul></section>
        <section><p class="eyebrow">Call to action</p><p>${escapeHtml(analysis.callToAction)}</p></section>
        <section><p class="eyebrow">Output brief</p>${projectFormat(project)}</section>
        <section class="transcript-disclosure"><details><summary>${project.transcript.source === "mock" ? "View mock transcript" : "View extracted transcript"}</summary><p>${escapeHtml(project.transcript.text)}</p></details></section>
      </aside>
    </div>
    <div class="sticky-action"><span><strong>Analysis complete</strong><small>The Scriptwriter will adapt the mechanics to “${escapeHtml(project.topic)}.”</small></span><button class="button button-primary" type="button" data-action="generate-script">Generate original script ${icon("arrow")}</button></div>`;
}
