const crypto = require("crypto");
const { AppError } = require("../../middleware/error-handler");

function invalid(path, reason) {
  return new AppError(
    502,
    "INVALID_LLM_RESPONSE",
    "The Storyboard Agent returned a response that did not match the required contract.",
    true,
    path ? [{ field: path, reason }] : null,
  );
}

function parseStoryboardJSON(value) {
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

function stringField(value, path, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw invalid(path, "required_string");
  }
  return value.replace(/\s+/g, " ").trim();
}

function narrationTokens(input) {
  return input.script.sections.flatMap((section) => section.text.match(/\S+/gu) || []);
}

function createScenePlan(input) {
  const tokens = narrationTokens(input);
  if (tokens.length < input.sceneCount) {
    throw new AppError(
      400,
      "INVALID_STORYBOARD_INPUT",
      "The script is too short for the requested number of storyboard scenes.",
      false,
      [{ field: "sceneCount", reason: "exceeds_narration_units" }],
    );
  }
  const baseSize = Math.floor(tokens.length / input.sceneCount);
  const remainder = tokens.length % input.sceneCount;
  let cursor = 0;
  return Array.from({ length: input.sceneCount }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0);
    const narration = tokens.slice(cursor, cursor + size).join(" ");
    cursor += size;
    return { slot: `scene-${index + 1}`, narration, weight: size };
  });
}

function requestFingerprint(input) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function normalizeStoryboard(raw, input, scenePlan, fingerprint = requestFingerprint(input)) {
  if (!Array.isArray(raw.scenes) || raw.scenes.length !== scenePlan.length) {
    throw invalid("scenes", "must_match_scene_plan");
  }
  const proposals = raw.scenes.map((scene, index) => {
    if (!scene || typeof scene !== "object" || Array.isArray(scene)) throw invalid(`scenes.${index}`, "invalid_object");
    if (scene.slot !== scenePlan[index].slot) throw invalid(`scenes.${index}.slot`, "must_match_scene_plan");
    return {
      caption: stringField(scene.caption, `scenes.${index}.caption`, 120),
      visual: stringField(scene.visual, `scenes.${index}.visual`, 600),
      searchQuery: stringField(scene.searchQuery, `scenes.${index}.searchQuery`, 240),
      transition: stringField(scene.transition, `scenes.${index}.transition`, 100),
    };
  });
  const totalWeight = scenePlan.reduce((sum, scene) => sum + scene.weight, 0);
  let timelineEnd = 0;
  const scenes = scenePlan.map((planned, index) => {
    const start = timelineEnd;
    timelineEnd = index === scenePlan.length - 1
      ? input.targetDurationSeconds
      : Math.round((timelineEnd + (input.targetDurationSeconds * planned.weight) / totalWeight) * 10) / 10;
    if (timelineEnd <= start) throw invalid(`scenes.${index}`, "duration_too_small");
    return {
      id: `scene-${index + 1}`,
      number: index + 1,
      start,
      end: timelineEnd,
      duration: Math.round((timelineEnd - start) * 10) / 10,
      narration: planned.narration,
      ...proposals[index],
    };
  });
  return {
    storyboardId: `storyboard_${fingerprint.slice(0, 20)}`,
    scriptId: input.script.scriptId,
    reviewId: input.approvedReviewId,
    totalDuration: input.targetDurationSeconds,
    format: input.format,
    scenes,
  };
}

module.exports = {
  createScenePlan,
  invalid,
  narrationTokens,
  normalizeStoryboard,
  parseStoryboardJSON,
  requestFingerprint,
};
