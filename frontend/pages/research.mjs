import { escapeHtml } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading } from "../components.mjs";

function confidenceLabel(value) {
  return value === "high" ? "High confidence" : value === "medium" ? "Medium confidence" : "Needs caution";
}

export function renderResearch(project) {
  if (project.error) {
    return `${pageHeading("Research Agent", "Topic research paused.", "Your analysis and tailored brief remain saved.")}${errorNotice(project.error, "retry-research", "Research Agent")}`;
  }
  if (!project.research) {
    return `${pageHeading("Research Agent", "Building a source-grounded Fact Pack.", "The agent is searching for claims that fit your angle, audience, viewer goal, and desired takeaway.")}${loadingPanel("Research Agent", "Checking current sources and separating facts from uncertainty…")}`;
  }
  const research = project.research;
  const brief = project.creativeBrief;
  return `${pageHeading("Research Agent · Complete", "The facts your script is allowed to use.", "Review the claims and open their sources before sending this Fact Pack to the Scriptwriter.", `<button class="button button-primary" type="button" data-action="generate-script">Write from Fact Pack ${icon("arrow")}</button>`)}
    <div class="research-layout">
      <section class="research-main">
        <div class="research-summary"><p class="eyebrow">Research synthesis</p><h2>${escapeHtml(research.summary)}</h2><p>${research.facts.length} usable claims · ${research.sources.length} provider-verified sources</p></div>
        <section aria-labelledby="fact-pack-heading">
          <div class="section-bar"><div><p class="eyebrow">Fact Pack</p><h2 id="fact-pack-heading">Claims for narration</h2></div><span>Not a factual guarantee</span></div>
          <ol class="fact-list">${research.facts.map((fact, index) => `<li class="fact-card">
            <div class="fact-index">${String(index + 1).padStart(2, "0")}</div>
            <div class="fact-copy"><div class="fact-meta"><span class="confidence confidence-${escapeHtml(fact.confidence)}">${confidenceLabel(fact.confidence)}</span><span>Usable in script</span></div><h3>${escapeHtml(fact.claim)}</h3><p>${escapeHtml(fact.explanation)}</p>
              <div class="fact-sources" aria-label="Sources for claim ${index + 1}">${fact.sourceIds.map((sourceId) => { const source = research.sources.find((item) => item.sourceId === sourceId); return source ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.domain)} ${icon("external", 13)}</a>` : ""; }).join("")}</div>
            </div>
          </li>`).join("")}</ol>
        </section>
        ${research.openQuestions.length ? `<section class="open-questions"><p class="eyebrow">Keep cautious</p><h2>Questions the sources did not fully settle</h2><ul>${research.openQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul></section>` : ""}
      </section>
      <aside class="research-aside">
        <section><p class="eyebrow">Tailored brief</p><dl class="brief-recap"><div><dt>Angle</dt><dd>${escapeHtml(brief.angle)}</dd></div><div><dt>Audience</dt><dd>${escapeHtml(brief.targetAudience)}</dd></div><div><dt>Viewer goal</dt><dd>${escapeHtml(brief.viewerGoal)}</dd></div><div><dt>Takeaway</dt><dd>${escapeHtml(brief.desiredTakeaway)}</dd></div><div><dt>Tone</dt><dd>${escapeHtml(brief.tone)}</dd></div></dl></section>
        <section><p class="eyebrow">Sources used</p><ol class="source-list">${research.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.title)}</strong><span>${escapeHtml(source.domain)} ${icon("external", 12)}</span></a></li>`).join("")}</ol></section>
        <section class="research-caution"><strong>Editorial check required</strong><p>Citations show where a claim came from; they do not guarantee that a source is complete, current, or free of error.</p></section>
      </aside>
    </div>
    <div class="sticky-action"><span><strong>Fact Pack ready</strong><small>The Scriptwriter will be told not to invent claims outside this reviewed pack.</small></span><button class="button button-primary" type="button" data-action="generate-script">Write from Fact Pack ${icon("arrow")}</button></div>`;
}

