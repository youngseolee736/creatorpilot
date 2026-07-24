import { escapeHtml, routeFor } from "../lib/core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading, projectFormat } from "../ui/components.mjs";

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function renderAnalysis(project) {
  const backToProjects = `<a class="button button-secondary" href="${routeFor("dashboard")}">← Back to projects</a>`;
  if (project.error) return `${pageHeading("Script Analyst Agent", "Reference analysis paused.", "The project remains saved and can be retried without starting over.", backToProjects)}${errorNotice(project.error, "retry-analysis")}`;
  if (!project.analysis) {
    const references = list(project.references);
    const transcriptCount = references.filter((reference) => reference.transcript).length;
    const analysisCount = references.filter((reference) => reference.analysis).length;
    const extracting = transcriptCount < references.length;
    const message = extracting
      ? `Extracting reference ${transcriptCount + 1} of ${references.length}…`
      : analysisCount < references.length
        ? `Analyzing story logic ${analysisCount + 1} of ${references.length}…`
        : "Combining the strongest storytelling patterns…";
    return `${pageHeading("Script Analyst Agent", "Reading the references like a storyteller.", "Each video stays separate before CreatorPilot combines what makes the stories work.", backToProjects)}${loadingPanel(extracting ? "Reference intake" : "Script Analyst Agent", message)}`;
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
  const references = list(project.references).length ? list(project.references) : project.transcript ? [{ position: 1, title: project.referenceTitle || "Reference video", transcript: project.transcript, analysis: project.analysis }] : [];
  const ensemble = analysis.ensemble;

  return `${pageHeading("Script Analyst Agent · Complete", "The story behind the video.", "See the core flow, then reuse it with a different topic.", `<div class="button-row">${backToProjects}<button class="button button-secondary" type="button" data-action="rerun-analysis">${icon("retry")}Analyze again</button><button class="button button-primary" type="button" data-action="research-topic">Research your topic ${icon("arrow")}</button></div>`)}
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
        ${ensemble?.mode === "deep" ? `<section class="ensemble-disclosure"><details><summary><span><strong>How the models compared</strong><small>Deep analysis · ${Math.round((ensemble.judgment?.confidence || 0) * 100)}% confidence</small></span>${icon("arrow", 16)}</summary><div class="ensemble-candidates">${list(ensemble.candidates).map((candidate) => `<article><p>${escapeHtml(candidate.focus)}</p><h3>${escapeHtml(candidate.id === "candidate-a" ? "Candidate A" : "Candidate B")}</h3><span>${escapeHtml(candidate.summary)}</span></article>`).join("")}</div><div class="ensemble-decision"><p class="eyebrow">Final Judge</p><strong>${escapeHtml(ensemble.judgment?.winner === "hybrid" ? "Combined decision" : "Best available candidate")}</strong><p>${escapeHtml(ensemble.judgment?.reason || "The strongest valid blueprint was selected.")}</p>${ensemble.degraded ? `<small>One model was unavailable, so CreatorPilot used the strongest completed result.</small>` : ""}</div></details></section>` : ""}
      </section>

      <aside class="analysis-aside">
        <section><p class="eyebrow">Output brief</p>${projectFormat(project)}</section>
        <section class="reference-set-summary"><p class="eyebrow">Reference set</p><ol>${references.map((reference) => `<li><span>${String(reference.position).padStart(2, "0")}</span><div><strong>${escapeHtml(reference.title)}</strong><small>${escapeHtml(reference.analysis?.hookType || "Story logic analyzed")}</small></div></li>`).join("")}</ol></section>
        ${doNotCopy.length ? `<section class="guardrail-disclosure"><details><summary>Originality guardrails</summary><ul class="technique-list">${doNotCopy.map((item) => `<li>${icon("shield", 16)}${escapeHtml(item)}</li>`).join("")}</ul></details></section>` : ""}
        <section class="transcript-disclosure"><details><summary>${references.length === 1 && references[0].transcript?.source === "mock" ? "View mock transcript" : "View reference details"}</summary>${references.length === 1 ? `<p>${escapeHtml(references[0].transcript?.text || "Transcript unavailable")}</p>` : references.map((reference) => `<details class="reference-detail"><summary>${String(reference.position).padStart(2, "0")} · ${escapeHtml(reference.title)}</summary><p>${escapeHtml(reference.analysis?.summary || "Analysis ready")}</p><p>${escapeHtml(reference.transcript?.text || "Transcript unavailable")}</p></details>`).join("")}</details></section>
      </aside>
    </div>`;
}
