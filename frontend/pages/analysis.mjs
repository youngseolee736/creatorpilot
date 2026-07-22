import { escapeHtml } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading, projectFormat } from "../components.mjs";

function sequence(items = []) {
  return `<ol class="story-sequence">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

export function renderAnalysis(project) {
  if (project.error) return `${pageHeading("Script Analyst Agent", "Reference analysis paused.", "The project remains saved and can be retried without starting over.")}${errorNotice(project.error, "retry-analysis")}`;
  if (!project.analysis) {
    const message = project.transcript ? "Finding the video's storytelling logic…" : "Extracting the reference transcript…";
    return `${pageHeading("Script Analyst Agent", "Reading the reference like a storyteller.", "CreatorPilot looks for how the story opens, develops, holds interest, and pays off.")}${loadingPanel(project.transcript ? "Script Analyst Agent" : "Transcript extraction", message)}`;
  }

  const analysis = project.analysis;
  const hook = analysis.hookMechanics || {};
  const narrative = analysis.narrativeStyle || {};
  const information = analysis.informationFlow || {};
  const watchReasons = Array.isArray(analysis.retentionMap) ? analysis.retentionMap.slice(0, 3) : [];
  const ending = analysis.structure?.[analysis.structure.length - 1]?.note || analysis.callToAction;

  return `${pageHeading("Script Analyst Agent · Complete", "How this video tells its story.", "A simple breakdown of the storytelling logic you can reuse with a different topic.", `<button class="button button-primary" type="button" data-action="research-topic">Research your topic ${icon("arrow")}</button>`)}
    <div class="analysis-layout story-analysis-layout">
      <section class="analysis-main">
        <section class="story-logic-section" aria-labelledby="story-logic-heading">
          <div class="section-bar"><div><p class="eyebrow">Story logic</p><h2 id="story-logic-heading">Why the story works</h2></div></div>
          <div class="story-logic">
            <article><span>01 · How it opens</span><h3>${escapeHtml(hook.trigger || analysis.hookType)}</h3><p>${escapeHtml(hook.curiosityGap || analysis.hookPurpose)}</p></article>
            <article><span>02 · What moves it forward</span><h3>${escapeHtml(narrative.narrativeEngine || analysis.summary)}</h3>${sequence(narrative.progression)}</article>
            <article><span>03 · How information is revealed</span><h3>${escapeHtml(information.pattern || analysis.pacing)}</h3><p>${escapeHtml(information.explanation || analysis.pacing)}</p>${sequence(information.sequence)}</article>
            <article><span>04 · Why viewers keep watching</span><ul class="watch-reasons">${watchReasons.map((item) => `<li><strong>${escapeHtml(item.type)}</strong><p>${escapeHtml(item.purpose)}</p></li>`).join("")}</ul></article>
            <article><span>05 · How it pays off</span><h3>${escapeHtml(hook.promisedPayoff || ending)}</h3><p>${escapeHtml(ending)}</p></article>
          </div>
        </section>

        <section class="story-blueprint" aria-labelledby="story-blueprint-heading">
          <div class="section-bar"><div><p class="eyebrow">Reusable story blueprint</p><h2 id="story-blueprint-heading">Use this logic for a new topic</h2></div></div>
          <ol>${(analysis.reusablePatterns || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
        </section>
      </section>

      <aside class="analysis-aside">
        ${analysis.doNotCopy?.length ? `<section><p class="eyebrow">Do not copy</p><ul class="technique-list">${analysis.doNotCopy.map((item) => `<li>${icon("shield", 16)}${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
        <section><p class="eyebrow">Output brief</p>${projectFormat(project)}</section>
        <section class="transcript-disclosure"><details><summary>${project.transcript.source === "mock" ? "View mock transcript" : "View extracted transcript"}</summary><p>${escapeHtml(project.transcript.text)}</p></details></section>
      </aside>
    </div>
    <div class="sticky-action"><span><strong>Story blueprint complete</strong><small>Next, research facts for your topic and write with this storytelling logic.</small></span><button class="button button-primary" type="button" data-action="research-topic">Research your topic ${icon("arrow")}</button></div>`;
}
