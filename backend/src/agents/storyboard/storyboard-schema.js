const { AppError } = require("../../middleware/error-handler");

const MIN_TARGET_DURATION = 15;
const MAX_TARGET_DURATION = 180;
const MAX_SCRIPT_CHARACTERS = 30000;
const TOP_LEVEL_FIELDS = new Set([
  "projectId",
  "script",
  "format",
  "targetDurationSeconds",
  "sceneCount",
  "visualConstraints",
]);

function detail(field, reason) {
  return [{ field, reason }];
}

function invalid(field, reason, message = "The Storyboard brief is invalid.") {
  throw new AppError(400, "INVALID_STORYBOARD_INPUT", message, false, detail(field, reason));
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

function normalizeScript(value) {
  if (!plainObject(value)) invalid("script", "required");
  if (!Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 24) {
    invalid("script.sections", "invalid_array");
  }
  let totalCharacters = 0;
  const sections = value.sections.map((section, index) => {
    if (!plainObject(section)) invalid(`script.sections.${index}`, "invalid_object");
    const text = requiredString(section.text, `script.sections.${index}.text`, { max: 6000, collapse: false });
    const range = requiredString(section.range, `script.sections.${index}.range`, { max: 32 });
    if (!/^\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?s$/u.test(range)) {
      invalid(`script.sections.${index}.range`, "invalid_range");
    }
    totalCharacters += text.length;
    return {
      id: requiredString(section.id, `script.sections.${index}.id`, { max: 100 }),
      label: requiredString(section.label, `script.sections.${index}.label`, { max: 80 }),
      range,
      text,
    };
  });
  if (totalCharacters > MAX_SCRIPT_CHARACTERS) invalid("script", "too_large");
  const version = Number(value.version);
  if (!Number.isInteger(version) || version < 1 || version > 10000) invalid("script.version", "invalid");
  return {
    scriptId: requiredString(value.scriptId, "script.scriptId", { max: 160 }),
    title: requiredString(value.title, "script.title", { max: 180 }),
    version,
    estimatedSeconds: Number(value.estimatedSeconds) || null,
    sections,
  };
}

function stringArray(value, field) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 12) invalid(field, "invalid_array");
  return value.map((item, index) => requiredString(item, `${field}.${index}`, { max: 300 }));
}

function validateStoryboardRequest(request) {
  if (!plainObject(request)) invalid("request", "invalid_object", "The storyboard request must be a JSON object.");
  const unexpected = Object.keys(request).find((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unexpected) invalid(unexpected, "unexpected_field");
  const targetDurationSeconds = Number(request.targetDurationSeconds);
  if (!Number.isInteger(targetDurationSeconds)
    || targetDurationSeconds < MIN_TARGET_DURATION
    || targetDurationSeconds > MAX_TARGET_DURATION) {
    invalid("targetDurationSeconds", "unsupported");
  }
  const script = normalizeScript(request.script);
  const narrationUnits = script.sections.reduce(
    (count, section) => count + (section.text.match(/\S+/gu) || []).length,
    0,
  );
  const sceneCount = request.sceneCount == null ? Math.min(8, narrationUnits) : Number(request.sceneCount);
  if (!Number.isInteger(sceneCount) || sceneCount < 1 || sceneCount > 30 || sceneCount > targetDurationSeconds) {
    invalid("sceneCount", "unsupported");
  }
  const format = requiredString(request.format, "format", { max: 8 });
  if (!["9:16", "1:1", "16:9"].includes(format)) invalid("format", "unsupported");
  return {
    projectId: requiredString(request.projectId, "projectId", { max: 128 }),
    script,
    format,
    targetDurationSeconds,
    sceneCount,
    visualConstraints: stringArray(request.visualConstraints, "visualConstraints"),
  };
}

module.exports = {
  MAX_SCRIPT_CHARACTERS,
  MAX_TARGET_DURATION,
  MIN_TARGET_DURATION,
  validateStoryboardRequest,
};
