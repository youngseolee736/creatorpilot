const { AppError } = require("../middleware/error-handler");

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function contractError(code, message, field, reason = "invalid") {
  return new AppError(400, code, message, false, [{ field, reason }]);
}

function text(value, field, options = {}) {
  const { min = 1, max = 500, optional = false, code = "INVALID_CREATIVE_BRIEF" } = options;
  if (optional && (value == null || value === "")) return "";
  if (typeof value !== "string") throw contractError(code, "The tailored creative brief is invalid.", field, "required");
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < min || normalized.length > max) {
    throw contractError(code, "The tailored creative brief is invalid.", field, "invalid_length");
  }
  return normalized;
}

function textList(value, field, options = {}) {
  const { maxItems = 8, maxLength = 300, code = "INVALID_CREATIVE_BRIEF" } = options;
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > maxItems) {
    throw contractError(code, "The tailored creative brief is invalid.", field, "invalid_array");
  }
  return value.map((item, index) => text(item, `${field}.${index}`, { max: maxLength, code }));
}

function normalizeCreativeBrief(value, options = {}) {
  const code = options.code || "INVALID_CREATIVE_BRIEF";
  if (!plainObject(value)) throw contractError(code, "A tailored creative brief is required.", "creativeBrief", "required");
  return {
    topic: text(value.topic, "creativeBrief.topic", { min: 3, max: 200, code }),
    angle: text(value.angle, "creativeBrief.angle", { min: 3, max: 400, code }),
    targetAudience: text(value.targetAudience, "creativeBrief.targetAudience", { min: 3, max: 400, code }),
    viewerGoal: text(value.viewerGoal, "creativeBrief.viewerGoal", { min: 3, max: 400, code }),
    desiredTakeaway: text(value.desiredTakeaway, "creativeBrief.desiredTakeaway", { min: 3, max: 500, code }),
    tone: text(value.tone, "creativeBrief.tone", { min: 2, max: 200, code }),
    language: text(value.language, "creativeBrief.language", { min: 2, max: 64, code }),
    mustInclude: textList(value.mustInclude, "creativeBrief.mustInclude", { code }),
    mustAvoid: textList(value.mustAvoid, "creativeBrief.mustAvoid", { code }),
    callToAction: text(value.callToAction, "creativeBrief.callToAction", { optional: true, max: 300, code }),
  };
}

function normalizeReferenceBlueprint(value, options = {}) {
  const code = options.code || "INVALID_REFERENCE_BLUEPRINT";
  if (!plainObject(value)) throw contractError(code, "A compact reference blueprint is required.", "referenceBlueprint", "required");
  const structure = value.structure;
  if (!Array.isArray(structure) || structure.length < 3 || structure.length > 6) {
    throw contractError(code, "The compact reference blueprint is invalid.", "referenceBlueprint.structure", "invalid_array");
  }
  let previousEnd = -1;
  const normalizedStructure = structure.map((section, index) => {
    if (!plainObject(section)) throw contractError(code, "The compact reference blueprint is invalid.", `referenceBlueprint.structure.${index}`, "invalid_object");
    const start = Number(section.start);
    const end = Number(section.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || start < previousEnd) {
      throw contractError(code, "The compact reference blueprint is invalid.", `referenceBlueprint.structure.${index}`, "invalid_timeline");
    }
    previousEnd = end;
    return {
      label: text(section.label, `referenceBlueprint.structure.${index}.label`, { max: 80, code }),
      start,
      end,
      purpose: text(section.purpose, `referenceBlueprint.structure.${index}.purpose`, { max: 400, code }),
    };
  });
  return {
    analysisId: text(value.analysisId, "referenceBlueprint.analysisId", { max: 160, code }),
    hookType: text(value.hookType, "referenceBlueprint.hookType", { max: 200, code }),
    hookPurpose: text(value.hookPurpose, "referenceBlueprint.hookPurpose", { max: 400, code }),
    tone: text(value.tone, "referenceBlueprint.tone", { max: 300, code }),
    pacing: text(value.pacing, "referenceBlueprint.pacing", { max: 300, code }),
    narrativeEngine: text(value.narrativeEngine || value.pacing, "referenceBlueprint.narrativeEngine", { max: 500, code }),
    informationPattern: text(value.informationPattern || value.pacing, "referenceBlueprint.informationPattern", { max: 300, code }),
    viewerJourney: text(value.viewerJourney || value.hookPurpose, "referenceBlueprint.viewerJourney", { max: 500, code }),
    ending: text(value.ending, "referenceBlueprint.ending", { max: 400, code }),
    retentionTechniques: textList(value.retentionTechniques, "referenceBlueprint.retentionTechniques", { maxItems: 3, code }),
    structure: normalizedStructure,
  };
}

module.exports = { normalizeCreativeBrief, normalizeReferenceBlueprint, plainObject, text, textList };
