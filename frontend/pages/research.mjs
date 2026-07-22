import { escapeHtml, routeFor } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading } from "../components.mjs";

function confidenceLabel(value) {
  return value === "high" ? "High confidence" : value === "medium" ? "Medium confidence" : "Needs caution";
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function verdictLabel(value) {
  return ({ supported: "Supported", partially_supported: "Partially supported", not_supported: "Not supported", insufficient_evidence: "Not enough evidence" })[value] || "Evidence review";
}

export function renderResearch(project) {
  if (project.error) {
    return `${pageHeading("Research Agent", "Topic research paused.", "Your analysis and tailored brief remain saved.")}${errorNotice(project.error, "retry-research", "Research Agent")}`;
  }
  if (!project.research) {
    return `${pageHeading("Research Agent", "Testing the claim against the evidence.", "The agent is defining fair criteria, comparing relevant peers, and checking both sides of the premise.")}${loadingPanel("Research Agent", "Searching current sources and building a fair comparison. This can take a few minutes—keep this tab open.")}`;
  }
  const research = project.research;
  const brief = project.creativeBrief;
  const facts = list(research.facts);
  const sources = list(research.sources);
  const comparisons = list(research.comparisons);
  const criteria = list(research.criteria);
  const comparisonSet = list(research.comparisonSet);
  const storyFindings = list(research.storyFindings);
  const openQuestions = list(research.openQuestions);
  const verdict = research.verdict || { status: "insufficient_evidence", headline: research.summary, explanation: "Review the sourced findings before writing." };
  const narrativeCase = research.narrativeCase;
  const sourceLinks = (sourceIds, label) => `<div class="fact-sources" aria-label="${escapeHtml(label)}">${list(sourceIds).map((sourceId) => { const source = sources.find((item) => item.sourceId === sourceId); return source ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.domain)} ${icon("external", 13)}</a>` : ""; }).join("")}</div>`;
  return `${pageHeading("Research Agent · Complete", "What the evidence says.", "See the verdict, the fair comparison, and the facts that can carry your story.", `<div class="button-row"><a class="button button-secondary" href="${routeFor("analysis", project.id)}">← Back to analysis</a><button class="button button-primary" type="button" data-action="generate-script">Write from research ${icon("arrow")}</button></div>`)}
    <div class="research-layout">
      <section class="research-main">
        <div class="research-summary research-verdict"><div class="verdict-meta"><p class="eyebrow">Research verdict</p><span class="verdict-status verdict-${escapeHtml(verdict.status)}">${verdictLabel(verdict.status)}</span></div><h2>${escapeHtml(verdict.headline)}</h2><p>${escapeHtml(verdict.explanation)}</p><small>${facts.length} usable findings · ${sources.length} verified sources</small></div>

        ${narrativeCase ? `<section class="narrative-case"><div><p class="eyebrow">Best way to prove the claim</p><span>${narrativeCase.mode === "direct" ? "Direct evidence" : narrativeCase.mode === "reframe" ? "Stronger narrative lens" : "No honest route yet"}</span></div><h2>${escapeHtml(narrativeCase.recommendedFrame)}</h2><blockquote>${escapeHtml(narrativeCase.thesis)}</blockquote><dl><div><dt>What the claim means</dt><dd>${escapeHtml(narrativeCase.definition)}</dd></div><div><dt>Why this case works</dt><dd>${escapeHtml(narrativeCase.whyItProvesClaim)}</dd></div><div><dt>Concede briefly</dt><dd>${escapeHtml(narrativeCase.concession)}</dd></div></dl><small>${list(narrativeCase.supportFactIds).map((factId) => escapeHtml(factId.replace("fact_", "Fact "))).join(" · ")}</small></section>` : ""}

        <section class="research-frame" aria-labelledby="research-frame-heading">
          <div class="section-bar"><div><p class="eyebrow">How the claim was tested</p><h2 id="research-frame-heading">A fair comparison</h2></div></div>
          <div class="research-frame-grid"><div><span>Criteria</span><ul>${criteria.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div><div><span>Compared with</span><ul>${comparisonSet.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div></div>
        </section>

        ${comparisons.length ? `<section class="comparison-section" aria-labelledby="comparison-heading"><div class="section-bar"><div><p class="eyebrow">Like-for-like evidence</p><h2 id="comparison-heading">How they compare</h2></div></div><div class="comparison-list">${comparisons.map((item) => `<article><div class="comparison-metric"><span>${escapeHtml(item.metric)}</span><strong>${escapeHtml(item.subject)}</strong><b>${escapeHtml(item.subjectValue)}</b></div><div class="comparison-versus">vs</div><div class="comparison-metric"><span>Benchmark</span><strong>${escapeHtml(item.benchmark)}</strong><b>${escapeHtml(item.benchmarkValue)}</b></div><p>${escapeHtml(item.interpretation)}</p>${sourceLinks(item.sourceIds, `Sources for ${item.metric}`)}</article>`).join("")}</div></section>` : ""}

        <section aria-labelledby="fact-pack-heading">
          <div class="section-bar"><div><p class="eyebrow">Best evidence</p><h2 id="fact-pack-heading">Facts that can carry the story</h2></div><span>Not a factual guarantee</span></div>
          <ol class="fact-list">${facts.map((fact, index) => `<li class="fact-card">
            <div class="fact-index">${String(index + 1).padStart(2, "0")}</div>
            <div class="fact-copy"><div class="fact-meta"><span class="story-role">${escapeHtml(fact.narrativeRole || "evidence")}</span><span class="confidence confidence-${escapeHtml(fact.confidence)}">${confidenceLabel(fact.confidence)}</span></div><h3>${escapeHtml(fact.claim)}</h3><p>${escapeHtml(fact.explanation)}</p>
              ${sourceLinks(fact.sourceIds, `Sources for claim ${index + 1}`)}
            </div>
          </li>`).join("")}</ol>
        </section>

        ${research.counterpoint ? `<section class="research-counterpoint"><p class="eyebrow">Where the claim gets weaker</p><h2>${escapeHtml(research.counterpoint.claim)}</h2><p>${escapeHtml(research.counterpoint.explanation)}</p>${sourceLinks(research.counterpoint.sourceIds, "Sources for counterpoint")}</section>` : ""}

        ${storyFindings.length ? `<section class="story-findings"><div class="section-bar"><div><p class="eyebrow">Apply the research</p><h2>How to use it in the story</h2></div></div><ol>${storyFindings.map((finding) => `<li><span>${escapeHtml(finding.role)}</span><p>${escapeHtml(finding.guidance)}</p><small>${list(finding.factIds).map((factId) => escapeHtml(factId.replace("fact_", "Fact "))).join(" · ")}</small></li>`).join("")}</ol></section>` : ""}

        ${openQuestions.length ? `<section class="open-questions"><p class="eyebrow">Keep cautious</p><h2>What the evidence did not settle</h2><ul>${openQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul></section>` : ""}
      </section>
      <aside class="research-aside">
        <section><p class="eyebrow">Tailored brief</p><dl class="brief-recap"><div><dt>Angle</dt><dd>${escapeHtml(brief.angle)}</dd></div><div><dt>Audience</dt><dd>${escapeHtml(brief.targetAudience)}</dd></div><div><dt>Viewer goal</dt><dd>${escapeHtml(brief.viewerGoal)}</dd></div><div><dt>Takeaway</dt><dd>${escapeHtml(brief.desiredTakeaway)}</dd></div><div><dt>Tone</dt><dd>${escapeHtml(brief.tone)}</dd></div></dl></section>
        <section><p class="eyebrow">Sources used</p><ol class="source-list">${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.title)}</strong><span>${escapeHtml(source.domain)} ${icon("external", 12)}</span></a></li>`).join("")}</ol></section>
        <section class="research-caution"><strong>Editorial check required</strong><p>Citations show where a claim came from; they do not guarantee that a source is complete, current, or free of error.</p></section>
      </aside>
    </div>`;
}
