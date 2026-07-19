const { AppError } = require("../../middleware/error-handler");

const REQUIRED_STRINGS = [
  "summary",
  "hookType",
  "hookPurpose",
  "targetAudience",
  "tone",
  "contentPromise",
  "pacing",
  "callToAction",
];
const REQUIRED_ARRAYS = ["retentionTechniques", "openLoops", "transitions", "reusablePatterns", "doNotCopy"];

function invalid(path, reason) {
  return new AppError(
    502,
    "INVALID_LLM_RESPONSE",
    "The Script Analyst returned a response that did not match the required contract.",
    true,
    path ? [{ field: path, reason }] : null,
  );
}

function parseAnalysisJSON(value) {
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
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) throw invalid(path, "required_string");
  return value.replace(/\s+/g, " ").trim();
}

function stringArray(value, path, { minItems = 0, maxItems = 12 } = {}) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) throw invalid(path, "invalid_array");
  return value.map((item, index) => stringField(item, `${path}.${index}`, 300));
}

function finiteNumber(value, path, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw invalid(path, "out_of_range");
  return Math.round(number * 1000) / 1000;
}

function normalizedWords(value) {
  return String(value || "").toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
}

function containsLongExcerpt(output, transcript, size = 8) {
  const transcriptWords = normalizedWords(transcript);
  if (transcriptWords.length < size) return false;
  const sourceSequences = new Set();
  for (let index = 0; index <= transcriptWords.length - size; index += 1) {
    sourceSequences.add(transcriptWords.slice(index, index + size).join(" "));
  }
  const values = [];
  const visit = (value) => {
    if (typeof value === "string") values.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(output);
  return values.some((value) => {
    const words = normalizedWords(value);
    for (let index = 0; index <= words.length - size; index += 1) {
      if (sourceSequences.has(words.slice(index, index + size).join(" "))) return true;
    }
    return false;
  });
}

function normalizeAnalysis(raw, input) {
  for (const field of REQUIRED_STRINGS) {
    if (!(field in raw)) throw invalid(field, "required");
  }
  for (const field of REQUIRED_ARRAYS) {
    if (!(field in raw)) throw invalid(field, "required");
  }
  for (const field of ["hookDuration", "confidence", "estimatedOriginalDuration", "structure"]) {
    if (!(field in raw)) throw invalid(field, "required");
  }

  const normalized = Object.fromEntries(REQUIRED_STRINGS.map((field) => [field, stringField(raw[field], field)]));
  normalized.hookDuration = finiteNumber(raw.hookDuration, "hookDuration", { min: 0, max: 30 });
  normalized.retentionTechniques = stringArray(raw.retentionTechniques, "retentionTechniques", { minItems: 1 });
  normalized.openLoops = stringArray(raw.openLoops, "openLoops");
  normalized.transitions = stringArray(raw.transitions, "transitions");
  normalized.reusablePatterns = stringArray(raw.reusablePatterns, "reusablePatterns", { minItems: 1 });
  normalized.doNotCopy = stringArray(raw.doNotCopy, "doNotCopy", { minItems: 1 });
  normalized.confidence = finiteNumber(raw.confidence, "confidence", { min: 0, max: 1 });

  const reportedDuration = finiteNumber(raw.estimatedOriginalDuration, "estimatedOriginalDuration", { min: 1, max: 7200 });
  const sourceDuration = Number(input.transcript.estimatedDuration);
  normalized.estimatedOriginalDuration = Number.isFinite(sourceDuration) && sourceDuration > 0
    ? Math.round(sourceDuration * 1000) / 1000
    : reportedDuration;

  if (!Array.isArray(raw.structure) || raw.structure.length < 2 || raw.structure.length > 24) {
    throw invalid("structure", "invalid_array");
  }
  const structureDrafts = raw.structure.map((section, index) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) throw invalid(`structure.${index}`, "invalid_object");
    const start = finiteNumber(section.start, `structure.${index}.start`, { min: 0, max: 7200 });
    const end = finiteNumber(section.end, `structure.${index}.end`, { min: 0, max: 7200 });
    if (end <= start) throw invalid(`structure.${index}.end`, "must_follow_start");
    return {
      label: stringField(section.label, `structure.${index}.label`, 80),
      start,
      end,
      note: stringField(section.note, `structure.${index}.note`, 300),
    };
  });
  const weights = structureDrafts.map((section) => section.end - section.start);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let timelineEnd = 0;
  normalized.structure = structureDrafts.map((section, index) => {
    const start = timelineEnd;
    timelineEnd = index === structureDrafts.length - 1
      ? normalized.estimatedOriginalDuration
      : Math.round((timelineEnd + (normalized.estimatedOriginalDuration * weights[index]) / totalWeight) * 1000) / 1000;
    if (timelineEnd <= start) throw invalid(`structure.${index}`, "duration_too_small");
    return { label: section.label, start, end: timelineEnd, note: section.note };
  });
  normalized.hookDuration = Math.min(normalized.hookDuration, normalized.structure[0].end);

  if (containsLongExcerpt(normalized, input.transcript.text)) {
    throw invalid("safety", "long_source_excerpt");
  }

  return {
    analysisId: `analysis_${input.projectId}`,
    ...normalized,
    safety: { longSourceExcerptsIncluded: false, maxQuotedWords: 0 },
  };
}

module.exports = { containsLongExcerpt, invalid, normalizeAnalysis, parseAnalysisJSON };
