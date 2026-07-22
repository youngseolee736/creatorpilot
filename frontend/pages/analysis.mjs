import { escapeHtml } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading, projectFormat } from "../components.mjs";

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function renderAnalysis(project) {
  if (project.error) return `${pageHeading("Script Analyst Agent", "Reference analysis paused.", "The project remains saved and can be retried without starting over.")}${errorNotice(project.error, "retry-analysis")}`;
  if (!project.analysis) {
    const message = project.transcript ? "Finding the video's storytelling logic…" : "Extracting the reference transcript…";
    return `${pageHeading("Script Analyst Agent", "Reading the reference like a storyteller.", "CreatorPilot looks for how the story opens, develops, and pays off.")}${loadingPanel(project.transcript ? "Script Analyst Agent" : "Transcript extraction", message)}`;
  }

  const analysis = project.analysis;
  const hook = analysis.hookMechanics || {};
  const narrative = analysis.narrativeStyle || {};
  const information = analysis.informationFlow || {};
  const examples = analysis.appliedExamples || {};
  const structure = list(analysis.structure);
  const reusablePatterns = list(analysis.reusablePatterns);
  const doNotCopy = list(analysis.doNotCopy);
  const ending = structure[structure.length - 1]?.note || analysis.callToAction || "Resolve the opening question.";
  const storyFlow = list(narrative.progression).slice(0, 5);

  return `${pageHeading("Script Analyst Agent · Complete", "The story behind the video.", "See the core flow, then reuse it with a different topic.", `<button class="button button-primary" type="button" data-action="research-topic">Research your topic ${icon("arrow")}</button>`)}
    <div class="analysis-layout compact-analysis-layout">
      <section class="analysis-main">
        <section class="story-snapshot" aria-labelledby="story-snapshot-heading">
          <p class="eyebrow">Story in one line</p>
          <h2 id="story-snapshot-heading">${escapeHtml(analysis.summary)}</h2>
          <ol class="story-flow" aria-label="Story flow">${storyFlow.map((item, index) => `<li><span>0${index + 1}</span>${escapeHtml(item)}</li>`).join("")}</ol>
        </section>

        <section class="story-essentials" aria-labelledby="story-essentials-heading">
          <div class="section-bar"><div><p class="eyebrow">What makes it work</p><h2 id="story-essentials-heading">Three story decisions</h2></div></div>
          <div class="story-essential-grid">
            <article><span>Opening</span><h3>${escapeHtml(hook.trigger || analysis.hookType)}</h3><p>${escapeHtml(hook.curiosityGap || analysis.hookPurpose)}</p>${examples.opening ? `<blockquote><small>For your topic</small>${escapeHtml(examples.opening)}</blockquote>` : ""}</article>
            <article><span>Build</span><h3>${escapeHtml(narrative.narrativeEngine || analysis.pacing)}</h3><p>${escapeHtml(information.explanation || information.pattern || analysis.pacing)}</p>${examples.build ? `<blockquote><small>For your topic</small>${escapeHtml(examples.build)}</blockquote>` : ""}</article>
            <article><span>Payoff</span><h3>${escapeHtml(hook.promisedPayoff || ending)}</h3><p>${escapeHtml(ending)}</p>${examples.payoff ? `<blockquote><small>For your topic</small>${escapeHtml(examples.payoff)}</blockquote>` : ""}</article>
          </div>
        </section>

        <section class="story-blueprint compact-story-blueprint" aria-labelledby="story-blueprint-heading">
          <div class="section-bar"><div><p class="eyebrow">Apply it</p><h2 id="story-blueprint-heading">Use this for your script</h2></div></div>
          <ol>${reusablePatterns.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        </section>
      </section>

      <aside class="analysis-aside">
        <section><p class="eyebrow">Output brief</p>${projectFormat(project)}</section>
        ${doNotCopy.length ? `<section class="guardrail-disclosure"><details><summary>Originality guardrails</summary><ul class="technique-list">${doNotCopy.map((item) => `<li>${icon("shield", 16)}${escapeHtml(item)}</li>`).join("")}</ul></details></section>` : ""}
        <section class="transcript-disclosure"><details><summary>${project.transcript.source === "mock" ? "View mock transcript" : "View extracted transcript"}</summary><p>${escapeHtml(project.transcript.text)}</p></details></section>
      </aside>
    </div>`;
}
