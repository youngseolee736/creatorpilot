const { AppError } = require("../../middleware/error-handler");
const { validLanguage } = require("../script-analyst/script-analyst-schema");

const MIN_TARGET_DURATION = 15;
const MAX_TARGET_DURATION = 180;
const MAX_SCRIPT_CHARACTERS = 30000;
const TOP_LEVEL_FIELDS = new Set([
  "projectId",
  "topic",
  "targetLanguage",
  "targetDurationSeconds",
  "audience",
  "referenceAnalysis",
  "currentScript",
  "revisionInstructions",
  "preserveSectionIds",
]);

function detail(field, reason) {
  return [{ field, reason }];
}

function invalid(field, reason, message = "The Scriptwriter brief is invalid.") {
  throw new AppError(400, "INVALID_SCRIPT_BRIEF", message, false, detail(field, reason));
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, field, { min = 1, max = 500 } = {}) {
  if (typeof value !== "string") invalid(field, "required");
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < min || normalized.length > max) invalid(field, "invalid_length");
  return normalized;
}

function optionalString(value, field, max = 500) {
  if (value == null || value === "") return null;
  return requiredString(value, field, { max });
}

function stringArray(value, field, { minItems = 0, maxItems = 12, maxLength = 500 } = {}) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) invalid(field, "invalid_array");
  return value.map((item, index) => requiredString(item, `${field}.${index}`, { max: maxLength }));
}

function normalizeReferenceAnalysis(value) {
  if (!plainObject(value)) invalid("referenceAnalysis", "required");
  const analysisId = requiredString(value.analysisId, "referenceAnalysis.analysisId", { max: 160 });
  const structure = value.structure;
  if (!Array.isArray(structure) || structure.length < 2 || structure.length > 12) {
    invalid("referenceAnalysis.structure", "invalid_array");
  }
  let previousEnd = -1;
  const normalizedStructure = structure.map((section, index) => {
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

  const array = (name, options = {}) => stringArray(value[name] || [], `referenceAnalysis.${name}`, options);
  return {
    analysisId,
    hookType: requiredString(value.hookType, "referenceAnalysis.hookType", { max: 200 }),
    hookPurpose: optionalString(value.hookPurpose, "referenceAnalysis.hookPurpose", 400),
    tone: requiredString(value.tone, "referenceAnalysis.tone", { max: 300 }),
    contentPromise: optionalString(value.contentPromise, "referenceAnalysis.contentPromise", 500),
    pacing: requiredString(value.pacing, "referenceAnalysis.pacing", { max: 300 }),
    retentionTechniques: array("retentionTechniques", { minItems: 1 }),
    openLoops: array("openLoops"),
    transitions: array("transitions"),
    callToAction: optionalString(value.callToAction, "referenceAnalysis.callToAction", 400),
    reusablePatterns: array("reusablePatterns"),
    doNotCopy: array("doNotCopy", { minItems: 1 }),
    structure: normalizedStructure,
  };
}

function normalizeCurrentScript(value) {
  if (!plainObject(value)) invalid("currentScript", "required");
  const sections = value.sections;
  if (!Array.isArray(sections) || sections.length < 1 || sections.length > 12) invalid("currentScript.sections", "invalid_array");
  let totalCharacters = 0;
  const normalizedSections = sections.map((section, index) => {
    if (!plainObject(section)) invalid(`currentScript.sections.${index}`, "invalid_object");
    const text = requiredString(section.text, `currentScript.sections.${index}.text`, { max: 6000 });
    totalCharacters += text.length;
    const range = requiredString(section.range, `currentScript.sections.${index}.range`, { max: 32 });
    if (!/^\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?s$/u.test(range)) {
      invalid(`currentScript.sections.${index}.range`, "invalid_range");
    }
    return {
      id: requiredString(section.id, `currentScript.sections.${index}.id`, { max: 100 }),
      label: requiredString(section.label, `currentScript.sections.${index}.label`, { max: 80 }),
      range,
      text,
    };
  });
  if (totalCharacters > MAX_SCRIPT_CHARACTERS) invalid("currentScript", "too_large");
  const version = Number(value.version);
  if (!Number.isInteger(version) || version < 1 || version > 10000) invalid("currentScript.version", "invalid");
  return {
    scriptId: requiredString(value.scriptId, "currentScript.scriptId", { max: 160 }),
    title: requiredString(value.title, "currentScript.title", { max: 180 }),
    version,
    estimatedSeconds: Number(value.estimatedSeconds) || null,
    sections: normalizedSections,
  };
}

function validateScriptRequest(request, { revision = false } = {}) {
  if (!plainObject(request)) invalid("request", "invalid_object", "The script request must be a JSON object.");
  if (Object.prototype.hasOwnProperty.call(request, "transcript")) invalid("transcript", "prohibited");
  const unexpected = Object.keys(request).find((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unexpected) invalid(unexpected, "unexpected_field");

  const projectId = requiredString(request.projectId, "projectId", { max: 128 });
  const topic = requiredString(request.topic, "topic", { min: 3, max: 140 });
  const targetLanguage = requiredString(request.targetLanguage, "targetLanguage", { min: 2, max: 64 });
  if (!validLanguage(targetLanguage)) invalid("targetLanguage", "invalid");
  const targetDurationSeconds = Number(request.targetDurationSeconds);
  if (!Number.isInteger(targetDurationSeconds)
    || targetDurationSeconds < MIN_TARGET_DURATION
    || targetDurationSeconds > MAX_TARGET_DURATION) {
    invalid("targetDurationSeconds", "unsupported");
  }
  const audience = requiredString(request.audience, "audience", { min: 3, max: 500 });
  const referenceAnalysis = normalizeReferenceAnalysis(request.referenceAnalysis);
  if (revision && (!Array.isArray(request.revisionInstructions) || !request.revisionInstructions.length)) {
    throw new AppError(400, "REVISION_INSTRUCTIONS_REQUIRED", "At least one revision instruction is required.", false);
  }
  const revisionInstructions = stringArray(request.revisionInstructions || [], "revisionInstructions", {
    minItems: 0,
    maxItems: 12,
    maxLength: 500,
  });
  const currentScript = revision ? normalizeCurrentScript(request.currentScript) : null;
  if (!revision && request.currentScript != null) invalid("currentScript", "not_allowed_for_initial_draft");

  return {
    projectId,
    topic,
    targetLanguage,
    targetDurationSeconds,
    audience,
    referenceAnalysis,
    currentScript,
    revisionInstructions,
    preserveSectionIds: revision ? request.preserveSectionIds !== false : false,
  };
}

module.exports = {
  MAX_SCRIPT_CHARACTERS,
  MAX_TARGET_DURATION,
  MIN_TARGET_DURATION,
  validateScriptRequest,
};
