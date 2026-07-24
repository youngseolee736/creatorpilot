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
  const trimmed = value.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw invalid(null, "malformed_json");
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw invalid(null, "malformed_json");
  }
}

function stringField(value, path, maxLength) {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) throw invalid(path, "required_string");
  return normalized.slice(0, maxLength);
}

function optionalStringField(value, path, maxLength) {
  if (value == null || value === "") return null;
  return stringField(value, path, maxLength);
}

function fallbackImagePrompt(scene, caption) {
  return [
    "Vertical editorial storyboard still, cinematic but realistic",
    scene.visual,
    `clear subject, simple background, no logos, no readable small text`,
    caption ? `caption concept: ${caption}` : "",
  ].filter(Boolean).join(", ").replace(/\s+/g, " ").trim();
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
  const rawScenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const proposals = scenePlan.map((planned, index) => {
    const scene = rawScenes[index] && typeof rawScenes[index] === "object" && !Array.isArray(rawScenes[index])
      ? rawScenes[index]
      : {};
    const visual = typeof scene.visual === "string" && scene.visual.trim()
      ? stringField(scene.visual, `scenes.${index}.visual`, 600)
      : `Visualize this narration beat: ${planned.narration}`.slice(0, 600);
    const caption = typeof scene.caption === "string" && scene.caption.trim()
      ? stringField(scene.caption, `scenes.${index}.caption`, 120)
      : planned.narration.slice(0, 120);
    const searchQuery = typeof scene.searchQuery === "string" && scene.searchQuery.trim()
      ? stringField(scene.searchQuery, `scenes.${index}.searchQuery`, 240)
      : visual.slice(0, 120);
    const transition = typeof scene.transition === "string" && scene.transition.trim()
      ? stringField(scene.transition, `scenes.${index}.transition`, 100)
      : "Cut";
    return {
      caption,
      visual,
      searchQuery,
      imagePrompt: optionalStringField(scene.imagePrompt, `scenes.${index}.imagePrompt`, 1200),
      transition,
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
      imagePrompt: proposals[index].imagePrompt || fallbackImagePrompt(proposals[index], proposals[index].caption),
    };
  });
  return {
    storyboardId: `storyboard_${fingerprint.slice(0, 20)}`,
    scriptId: input.script.scriptId,
    totalDuration: input.targetDurationSeconds,
    format: input.format,
    scenes,
  };
}

module.exports = {
  createScenePlan,
  fallbackImagePrompt,
  invalid,
  narrationTokens,
  normalizeStoryboard,
  parseStoryboardJSON,
  requestFingerprint,
};
