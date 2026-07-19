const { AppError } = require("../../middleware/error-handler");

const TOP_LEVEL_FIELDS = new Set([
  "projectId",
  "approvedReviewId",
  "storyboard",
  "productionSettings",
  "format",
  "durationSeconds",
]);
const SCENE_FIELDS = new Set([
  "id", "number", "start", "end", "duration", "narration", "caption",
  "visual", "searchQuery", "transition",
]);
const SETTING_FIELDS = new Set(["voice", "captions", "music"]);

function invalid(field, reason, status = 400, code = "INVALID_RENDER_INPUT", message = "The render request is invalid.") {
  throw new AppError(status, code, message, false, [{ field, reason }]);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, field, max = 500) {
  if (typeof value !== "string") invalid(field, "required");
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > max) invalid(field, "invalid_length");
  return normalized;
}

function finiteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) invalid(field, "invalid_number");
  return Math.round(number * 1000) / 1000;
}

function normalizeStoryboard(value, durationSeconds) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) invalid("storyboard", "invalid_array");
  let previousEnd = 0;
  let narrationCharacters = 0;
  const scenes = value.map((scene, index) => {
    if (!plainObject(scene)) invalid(`storyboard.${index}`, "invalid_object");
    const unexpected = Object.keys(scene).find((field) => !SCENE_FIELDS.has(field));
    if (unexpected) invalid(`storyboard.${index}.${unexpected}`, "unexpected_field");
    const number = Number(scene.number);
    const start = finiteNumber(scene.start, `storyboard.${index}.start`);
    const end = finiteNumber(scene.end, `storyboard.${index}.end`);
    const duration = finiteNumber(scene.duration, `storyboard.${index}.duration`);
    if (!Number.isInteger(number) || number !== index + 1) invalid(`storyboard.${index}.number`, "must_be_sequential");
    if (Math.abs(start - previousEnd) > 0.001 || end <= start || Math.abs(duration - (end - start)) > 0.001) {
      invalid(`storyboard.${index}`, "invalid_timeline", 422, "ASSET_OR_TIMELINE_INVALID", "The storyboard timeline is not renderable.");
    }
    previousEnd = end;
    const narration = requiredString(scene.narration, `storyboard.${index}.narration`, 6000);
    narrationCharacters += narration.length;
    return {
      id: requiredString(scene.id, `storyboard.${index}.id`, 100),
      number,
      start,
      end,
      duration,
      narration,
      caption: requiredString(scene.caption, `storyboard.${index}.caption`, 120),
      visual: requiredString(scene.visual, `storyboard.${index}.visual`, 600),
      searchQuery: requiredString(scene.searchQuery, `storyboard.${index}.searchQuery`, 240),
      transition: requiredString(scene.transition, `storyboard.${index}.transition`, 100),
    };
  });
  if (narrationCharacters > 30000) invalid("storyboard", "too_large");
  if (Math.abs(previousEnd - durationSeconds) > 0.001) {
    invalid("storyboard", "duration_mismatch", 422, "ASSET_OR_TIMELINE_INVALID", "The storyboard does not end at the requested duration.");
  }
  return scenes;
}

function validateRenderRequest(request) {
  if (!plainObject(request)) invalid("request", "invalid_object");
  const unexpected = Object.keys(request).find((field) => !TOP_LEVEL_FIELDS.has(field));
  if (unexpected) invalid(unexpected, "unexpected_field");
  const durationSeconds = Number(request.durationSeconds);
  if (!Number.isInteger(durationSeconds) || durationSeconds < 15 || durationSeconds > 180) {
    invalid("durationSeconds", "unsupported");
  }
  const format = requiredString(request.format, "format", 8);
  if (!["9:16", "1:1", "16:9"].includes(format)) invalid("format", "unsupported");
  if (!plainObject(request.productionSettings)) invalid("productionSettings", "required");
  const unexpectedSetting = Object.keys(request.productionSettings).find((field) => !SETTING_FIELDS.has(field));
  if (unexpectedSetting) invalid(`productionSettings.${unexpectedSetting}`, "unexpected_field");
  if (typeof request.productionSettings.music !== "boolean") invalid("productionSettings.music", "required_boolean");
  const productionSettings = {
    voice: requiredString(request.productionSettings.voice, "productionSettings.voice", 120),
    captions: requiredString(request.productionSettings.captions, "productionSettings.captions", 120),
    music: request.productionSettings.music,
  };
  return {
    projectId: requiredString(request.projectId, "projectId", 128),
    approvedReviewId: requiredString(request.approvedReviewId, "approvedReviewId", 160),
    storyboard: normalizeStoryboard(request.storyboard, durationSeconds),
    productionSettings,
    format,
    durationSeconds,
  };
}

module.exports = { validateRenderRequest };
