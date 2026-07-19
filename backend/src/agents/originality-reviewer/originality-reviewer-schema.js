const { AppError } = require("../../middleware/error-handler");

const MAX_REFERENCE_CHARACTERS = 100000;
const MAX_SCRIPT_CHARACTERS = 30000;
const DEFAULT_THRESHOLDS = Object.freeze({
  minimumOverall: 80,
  maximumPhraseOverlapRisk: "medium",
});
const TOP_LEVEL_FIELDS = new Set([
  "projectId",
  "referenceTranscript",
  "referenceAnalysis",
  "script",
  "thresholds",
]);

function detail(field, reason) {
  return [{ field, reason }];
}

function invalid(field, reason, message = "The originality review input is invalid.") {
  throw new AppError(400, "INVALID_REVIEW_INPUT", message, false, detail(field, reason));
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, field, { min = 1, max = 500, collapse = true } = {}) {
  if (typeof value !== "string") invalid(field, "required");
  const normalized = collapse ? value.replace(/\s+/g, " ").trim() : value.trim();
  if (normalized.length < min || normalized.length > max) invalid(field, "invalid_length");
  return normalized;
}

function normalizeReferenceTranscript(value) {
  if (!plainObject(value)) invalid("referenceTranscript", "required");
  return {
    transcriptId: requiredString(value.transcriptId, "referenceTranscript.transcriptId", { max: 160 }),
    text: requiredString(value.text, "referenceTranscript.text", {
      min: 10,
      max: MAX_REFERENCE_CHARACTERS,
      collapse: false,
    }),
  };
}

function normalizeReferenceAnalysis(value) {
  if (!plainObject(value)) invalid("referenceAnalysis", "required");
  if (!Array.isArray(value.structure) || value.structure.length < 2 || value.structure.length > 24) {
    invalid("referenceAnalysis.structure", "invalid_array");
  }
  let previousEnd = -1;
  const structure = value.structure.map((section, index) => {
    if (!plainObject(section)) invalid(`referenceAnalysis.structure.${index}`, "invalid_object");
    const start = Number(section.start);
    const end = Number(section.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || start < previousEnd) {
      invalid(`referenceAnalysis.structure.${index}`, "invalid_timeline");
    }
    previousEnd = end;
    return {
      label: requiredString(section.label, `referenceAnalysis.structure.${index}.label`, { max: 80 }),
      start,
      end,
      note: requiredString(section.note, `referenceAnalysis.structure.${index}.note`, { max: 400 }),
    };
  });
  return {
    analysisId: requiredString(value.analysisId, "referenceAnalysis.analysisId", { max: 160 }),
    hookType: typeof value.hookType === "string" ? requiredString(value.hookType, "referenceAnalysis.hookType", { max: 200 }) : null,
    pacing: typeof value.pacing === "string" ? requiredString(value.pacing, "referenceAnalysis.pacing", { max: 300 }) : null,
    structure,
  };
}

function normalizeScript(value) {
  if (!plainObject(value)) invalid("script", "required");
  if (!Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 24) {
    invalid("script.sections", "invalid_array");
  }
  let totalCharacters = 0;
  const sections = value.sections.map((section, index) => {
    if (!plainObject(section)) invalid(`script.sections.${index}`, "invalid_object");
    const text = requiredString(section.text, `script.sections.${index}.text`, { max: 6000, collapse: false });
    totalCharacters += text.length;
    return {
      id: requiredString(section.id, `script.sections.${index}.id`, { max: 100 }),
      label: requiredString(section.label, `script.sections.${index}.label`, { max: 80 }),
      range: requiredString(section.range, `script.sections.${index}.range`, { max: 32 }),
      text,
    };
  });
  if (totalCharacters > MAX_SCRIPT_CHARACTERS) invalid("script", "too_large");
  const version = Number(value.version);
  if (!Number.isInteger(version) || version < 1 || version > 10000) invalid("script.version", "invalid");
  const estimatedSeconds = Number(value.estimatedSeconds);
  if (!Number.isFinite(estimatedSeconds) || estimatedSeconds <= 0 || estimatedSeconds > 300) {
    invalid("script.estimatedSeconds", "invalid");
  }
  return {
    scriptId: requiredString(value.scriptId, "script.scriptId", { max: 160 }),
    title: requiredString(value.title, "script.title", { max: 180 }),
    version,
    estimatedSeconds,
    sections,
  };
}

function normalizeThresholds(value) {
  if (value == null) return { ...DEFAULT_THRESHOLDS };
  if (!plainObject(value)) invalid("thresholds", "invalid_object");
  const unexpected = Object.keys(value).find((field) => !Object.prototype.hasOwnProperty.call(DEFAULT_THRESHOLDS, field));
  if (unexpected) invalid(`thresholds.${unexpected}`, "unexpected_field");
  const minimumOverall = value.minimumOverall == null
    ? DEFAULT_THRESHOLDS.minimumOverall
    : Number(value.minimumOverall);
  if (!Number.isInteger(minimumOverall) || minimumOverall < 0 || minimumOverall > 100) {
    invalid("thresholds.minimumOverall", "out_of_range");
  }
  const maximumPhraseOverlapRisk = String(
    value.maximumPhraseOverlapRisk || DEFAULT_THRESHOLDS.maximumPhraseOverlapRisk,
  ).toLowerCase();
  if (!["low", "medium", "high"].includes(maximumPhraseOverlapRisk)) {
    invalid("thresholds.maximumPhraseOverlapRisk", "invalid_enum");
  }
  return { minimumOverall, maximumPhraseOverlapRisk };
}

function validateReviewRequest(request) {
  if (!plainObject(request)) invalid("request", "invalid_object", "The review request must be a JSON object.");
  const unexpected = Object.keys(request).find((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unexpected) invalid(unexpected, "unexpected_field");
  return {
    projectId: requiredString(request.projectId, "projectId", { max: 128 }),
    referenceTranscript: normalizeReferenceTranscript(request.referenceTranscript),
    referenceAnalysis: normalizeReferenceAnalysis(request.referenceAnalysis),
    script: normalizeScript(request.script),
    thresholds: normalizeThresholds(request.thresholds),
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  MAX_REFERENCE_CHARACTERS,
  MAX_SCRIPT_CHARACTERS,
  validateReviewRequest,
};
