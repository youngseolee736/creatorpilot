const crypto = require("crypto");
const { AppError } = require("../../middleware/error-handler");

const DISCLAIMER = "This similarity review is an originality estimate, not a copyright or legal determination.";
const RISK_RANK = Object.freeze({ low: 0, medium: 1, high: 2 });

function invalid(path, reason) {
  return new AppError(
    502,
    "INVALID_LLM_RESPONSE",
    "The Originality Reviewer returned a response that did not match the required contract.",
    true,
    path ? [{ field: path, reason }] : null,
  );
}

function parseReviewJSON(value) {
  if (typeof value !== "string") throw invalid(null, "not_json_text");
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) throw invalid(null, "malformed_json");
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw invalid(null, "malformed_json");
  }
}

function stringField(value, path, maxLength = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw invalid(path, "required_string");
  }
  return value.replace(/\s+/g, " ").trim();
}

function integerScore(value, path) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw invalid(path, "out_of_range");
  return Math.round(number);
}

function canonicalText(value) {
  return (String(value || "").toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) || []).join(" ");
}

function exactExcerpt(value, source, path) {
  const excerpt = stringField(value, path, 240);
  const normalizedExcerpt = canonicalText(excerpt);
  if (!normalizedExcerpt || !canonicalText(source).includes(normalizedExcerpt)) {
    throw invalid(path, "must_be_exact_source_excerpt");
  }
  return excerpt;
}

function normalizeRisk(value, path) {
  const risk = String(value || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(RISK_RANK, risk)) throw invalid(path, "invalid_enum");
  return risk;
}

function structureRisk(score) {
  if (score <= 35) return "low";
  if (score <= 65) return "medium";
  return "high";
}

function requestFingerprint(input) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function normalizeReview(raw, input, fingerprint = requestFingerprint(input)) {
  const originalityEstimate = integerScore(raw.originalityEstimate, "originalityEstimate");
  if (!raw.structureSimilarity || typeof raw.structureSimilarity !== "object" || Array.isArray(raw.structureSimilarity)) {
    throw invalid("structureSimilarity", "required_object");
  }
  const structureScore = integerScore(raw.structureSimilarity.score, "structureSimilarity.score");
  const structureSimilarity = {
    score: structureScore,
    risk: structureRisk(structureScore),
    note: stringField(raw.structureSimilarity.note, "structureSimilarity.note", 500),
  };
  if (!raw.scores || typeof raw.scores !== "object" || Array.isArray(raw.scores)) {
    throw invalid("scores", "required_object");
  }
  const scores = Object.fromEntries(["hook", "structure", "clarity", "duration"].map((field) => [
    field,
    integerScore(raw.scores[field], `scores.${field}`),
  ]));
  const scriptText = input.script.sections.map((section) => section.text).join("\n");
  const referenceText = (input.referenceTranscripts || [input.referenceTranscript]).map((transcript) => transcript.text).join("\n");
  if (!Array.isArray(raw.overlaps) || raw.overlaps.length > 8) throw invalid("overlaps", "invalid_array");
  const overlaps = raw.overlaps.map((overlap, index) => {
    if (!overlap || typeof overlap !== "object" || Array.isArray(overlap)) {
      throw invalid(`overlaps.${index}`, "invalid_object");
    }
    const risk = normalizeRisk(overlap.risk, `overlaps.${index}.risk`);
    return {
      reference: exactExcerpt(overlap.reference, referenceText, `overlaps.${index}.reference`),
      generated: exactExcerpt(overlap.generated, scriptText, `overlaps.${index}.generated`),
      risk: `${risk[0].toUpperCase()}${risk.slice(1)}`,
      note: stringField(overlap.note, `overlaps.${index}.note`, 500),
    };
  });
  if (!Array.isArray(raw.instructions) || raw.instructions.length > 12) {
    throw invalid("instructions", "invalid_array");
  }
  const instructions = raw.instructions.map((item, index) => stringField(item, `instructions.${index}`, 500));
  const summary = stringField(raw.summary, "summary", 700);
  const overall = Math.round(
    originalityEstimate * 0.5
      + scores.hook * 0.1
      + scores.structure * 0.15
      + scores.clarity * 0.15
      + scores.duration * 0.1,
  );
  const highestPhraseRisk = overlaps.reduce(
    (highest, overlap) => Math.max(highest, RISK_RANK[overlap.risk.toLowerCase()]),
    0,
  );
  const allowedPhraseRisk = RISK_RANK[input.thresholds.maximumPhraseOverlapRisk];
  const status = overall >= input.thresholds.minimumOverall
    && highestPhraseRisk <= allowedPhraseRisk
    && structureSimilarity.risk !== "high"
    ? "passed"
    : "failed";

  return {
    reviewId: `review_${fingerprint.slice(0, 20)}`,
    scriptId: input.script.scriptId,
    status,
    overall,
    originalityEstimate,
    structureSimilarity,
    scores,
    summary,
    overlaps,
    instructions,
    disclaimer: DISCLAIMER,
  };
}

module.exports = {
  DISCLAIMER,
  RISK_RANK,
  canonicalText,
  invalid,
  normalizeReview,
  parseReviewJSON,
  requestFingerprint,
  structureRisk,
};
