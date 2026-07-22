import { escapeHtml, routeFor } from "../core.mjs";
import { errorNotice, icon, loadingPanel, pageHeading, statusBadge } from "../components.mjs";

function scoreCard(score, label) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const signal = value >= 85 ? "Strong" : value >= 70 ? "Good" : "Needs work";
  const tone = value >= 85 ? "strong" : value >= 70 ? "good" : "weak";
  return `<article class="score-card score-${tone}" aria-label="${escapeHtml(label)} ${value} out of 100"><header><span>${escapeHtml(label)}</span><div><strong>${value}</strong><small>/100</small></div></header><div class="score-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><i style="--score:${value}%"></i></div><small class="score-signal">${signal}</small></article>`;
}

function riskClass(risk) {
  const normalized = String(risk || "").toLowerCase();
  return ["low", "medium", "high"].includes(normalized) ? `risk-${normalized}` : "risk-medium";
}

export function renderReview(project) {
  const backToScript = `<a class="button button-secondary" href="${routeFor("script", project.id)}">← Back to Scriptwriter</a>`;
  if (project.error) return `${pageHeading("Originality Reviewer Agent", "Similarity review paused.", "The current script remains saved.", backToScript)}${errorNotice(project.error, "retry-review", "Originality Reviewer")}`;
  if (!project.originalityReview) {
    return `${pageHeading("Originality Reviewer Agent", "Comparing ideas without flattening them.", "The reviewer checks potential phrase overlap, clarity, structure, hook strength, and duration.", backToScript)}${loadingPanel("Originality Reviewer Agent", "Reviewing the generated script…")}`;
  }
  const review = project.originalityReview;
  const passed = review.status === "passed";
  return `${pageHeading("Originality Reviewer Agent · Complete", "Originality estimate and revision evidence.", "Potential overlap is presented for editorial judgment, not as a legal conclusion.", `<div class="button-row"><a class="button button-secondary" href="${routeFor("script", project.id)}">← Back to Scriptwriter</a>${statusBadge(passed ? "passed" : "revision_required")}</div>`)}
    <section class="review-hero review-${escapeHtml(review.status)}">
      <div class="overall-score"><span>Overall originality estimate</span><strong>${review.overall}</strong><small>out of 100</small></div>
      <div class="review-verdict"><p class="eyebrow">Review status</p><h2>${passed ? "Passed for production" : "Revision required"}</h2><p>${escapeHtml(review.summary)}</p></div>
      <div class="review-disclaimer"><strong>Important</strong><p>${escapeHtml(review.disclaimer)}</p></div>
    </section>
    <section class="score-section"><div class="section-bar"><div><p class="eyebrow">Quality signals</p><h2>Draft scorecard</h2></div><span>Four practical writing checks</span></div><div class="score-grid">${scoreCard(review.scores.hook, "Hook strength")}${scoreCard(review.scores.structure, "Structure")}${scoreCard(review.scores.clarity, "Clarity")}${scoreCard(review.scores.duration, "Duration")}</div></section>
    <section class="comparison-section"><div class="section-bar"><div><p class="eyebrow">Editorial evidence</p><h2>Potential phrase overlap</h2></div><span>${review.overlaps.length} patterns reviewed</span></div>
      <div class="comparison-list">${review.overlaps.map((overlap, index) => `<article class="comparison-item"><div class="comparison-index">0${index + 1}</div><div class="phrase phrase-reference"><span>Reference phrase</span><blockquote>“${escapeHtml(overlap.reference)}”</blockquote></div><div class="comparison-arrow" aria-hidden="true">→</div><div class="phrase phrase-generated"><span>Generated phrase</span><blockquote>“${escapeHtml(overlap.generated)}”</blockquote></div><div class="risk-note"><span class="${riskClass(overlap.risk)}">${escapeHtml(overlap.risk)} overlap</span><p>${escapeHtml(overlap.note)}</p></div></article>`).join("")}</div>
    </section>
    <section class="review-instructions"><div><p class="eyebrow">Reviewer instructions</p><h2>${passed ? "Guidance for production" : "Required revisions"}</h2></div><ol>${review.instructions.map((instruction) => `<li>${escapeHtml(instruction)}</li>`).join("")}</ol></section>
    <div class="sticky-action"><span><strong>${passed ? "Script cleared for the mock production stage" : "The Scriptwriter needs another pass"}</strong><small>You remain responsible for reviewing the final wording and sources.</small></span><div class="button-row"><button class="button button-secondary" type="button" data-action="send-back-script">Send back to Scriptwriter</button>${passed ? `<button class="button button-primary" type="button" data-action="approve-production">Approve for video production ${icon("arrow")}</button>` : ""}</div></div>`;
}
