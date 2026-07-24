const crypto = require("crypto");
const { AppError } = require("../../middleware/error-handler");

function invalid(path, reason) {
  return new AppError(
    502,
    "INVALID_LLM_RESPONSE",
    "The Scriptwriter returned a response that did not match the required contract.",
    true,
    path ? [{ field: path, reason }] : null,
  );
}

function parseScriptJSON(value) {
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

function stringField(value, path, maxLength = 500) {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) throw invalid(path, "required_string");
  return normalized.slice(0, maxLength);
}

function slug(value, fallback) {
  const normalized = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

function allocateDurations(weights, target) {
  const count = weights.length;
  if (target < count) throw invalid("sections", "too_many_sections_for_duration");
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || count;
  const shares = weights.map((weight, index) => {
    const exact = target * ((weight || 1) / totalWeight);
    return { index, floor: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  const durations = shares.map((share) => Math.max(1, share.floor));
  let difference = target - durations.reduce((sum, duration) => sum + duration, 0);
  shares.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; difference > 0; index = (index + 1) % shares.length) {
    durations[shares[index].index] += 1;
    difference -= 1;
  }
  shares.reverse();
  for (let index = 0; difference < 0; index = (index + 1) % shares.length) {
    const targetIndex = shares[index].index;
    if (durations[targetIndex] > 1) {
      durations[targetIndex] -= 1;
      difference += 1;
    }
  }
  return durations;
}

function parseRangeDuration(range) {
  const match = String(range).match(/^(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)s$/u);
  return match ? Math.max(1, Number(match[2]) - Number(match[1])) : 1;
}

function createSectionPlan(input) {
  const source = input.currentScript
    ? input.currentScript.sections.map((section) => ({
      id: section.id,
      label: section.label,
      weight: parseRangeDuration(section.range),
    }))
    : input.referenceBlueprint.structure.map((section, index) => ({
      id: slug(section.label, `section-${index + 1}`),
      label: section.label,
      weight: section.end - section.start,
    }));

  const used = new Map();
  const unique = source.map((section, index) => {
    const base = input.currentScript && input.preserveSectionIds ? section.id : slug(section.id, `section-${index + 1}`);
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return { ...section, id: count === 1 ? base : `${base}-${count}` };
  });
  const durations = allocateDurations(unique.map((section) => section.weight), input.targetDurationSeconds);
  let start = 0;
  return unique.map((section, index) => {
    const end = start + durations[index];
    const planned = { slot: section.id, label: section.label, start, end };
    start = end;
    return planned;
  });
}

function estimateSpeechSeconds(text, language) {
  const words = String(text).match(/[\p{L}\p{N}']+/gu) || [];
  const compactCharacters = String(text).replace(/\s|[\p{P}\p{S}]/gu, "");
  const normalizedLanguage = String(language || "").toLowerCase();
  if (/korean|한국|ko\b/.test(normalizedLanguage)) {
    return Math.max(words.length / 2.7, compactCharacters.length / 5.2);
  }
  if (/chinese|mandarin|japanese|中文|日本|zh\b|ja\b/.test(normalizedLanguage)) {
    return Math.max(words.length / 2.7, compactCharacters.length / 4.5);
  }
  return words.length / 2.5;
}

function durationToleranceSeconds(targetDurationSeconds) {
  return Math.max(20, Math.round(targetDurationSeconds * 0.35));
}

function requestFingerprint(input, mode) {
  return crypto.createHash("sha256").update(JSON.stringify({ mode, input })).digest("hex");
}

const CLAIM_STOP_WORDS = new Set(["why", "how", "what", "when", "where", "who", "is", "are", "the", "a", "an", "to", "than", "in", "on", "of", "and", "or", "for", "with"]);

function meaningfulClaimWords(value) {
  return [...new Set((String(value).toLowerCase().match(/[\p{L}\p{N}']+/gu) || [])
    .filter((word) => word.length >= 3 && !CLAIM_STOP_WORDS.has(word)))];
}

function claimStrategy(input) {
  const status = input.factPack.verdict.status;
  const narrativeCase = input.factPack.narrativeCase;
  const mode = narrativeCase.mode === "direct" ? "direct_case" : narrativeCase.mode === "reframe" ? "reframed_case" : "evidence_boundary";
  return {
    mode,
    researchStatus: status,
    frame: narrativeCase.recommendedFrame,
    explanation: mode === "direct_case"
      ? "The script proves the claim with direct evidence."
      : mode === "reframed_case"
        ? "The script proves the claim through the strongest transparent narrative lens."
        : "The script marks the evidence boundary because no honest supporting route was found.",
  };
}

function attachFactId(sections, usedFactIds, factId, preferredIndex = 0) {
  if (!factId || usedFactIds.has(factId) || !sections.length) return;
  const orderedIndexes = [
    preferredIndex % sections.length,
    ...sections.map((_, index) => index),
  ];
  const targetIndex = orderedIndexes.find((index) => sections[index].factIds.length < 3);
  if (targetIndex == null) return;
  sections[targetIndex].factIds.push(factId);
  usedFactIds.add(factId);
}

function backfillFactIds(sections, usedFactIds, input) {
  const knownFactIds = new Set(input.factPack.facts.map((fact) => fact.factId));
  const narrativeFactIds = input.factPack.narrativeCase.supportFactIds.filter((factId) => knownFactIds.has(factId));
  narrativeFactIds.forEach((factId, index) => attachFactId(sections, usedFactIds, factId, index));
  input.factPack.facts.forEach((fact, index) => {
    if (usedFactIds.size >= 2) return;
    attachFactId(sections, usedFactIds, fact.factId, index);
  });
}

function normalizeScript(raw, input, plan, mode, fingerprint) {
  const claim = input.creativeBrief.topic;
  const title = typeof raw.title === "string" && raw.title.trim()
    ? raw.title.replace(/\s+/g, " ").trim().slice(0, 180)
    : claim.slice(0, 180);
  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];

  let fullText = "";
  const knownFactIds = new Set(input.factPack.facts.map((fact) => fact.factId));
  const usedFactIds = new Set();
  const sections = plan.map((planned, index) => {
    const section = rawSections[index] && typeof rawSections[index] === "object" && !Array.isArray(rawSections[index])
      ? rawSections[index]
      : {};
    const text = typeof section.text === "string" && section.text.trim()
      ? stringField(section.text, `sections.${index}.text`, 6000)
      : `${claim}`;
    const rawFactIds = Array.isArray(section.factIds) ? section.factIds.slice(0, 3) : [];
    const factIds = [...new Set(rawFactIds
      .map((factId) => (typeof factId === "string" ? factId.replace(/\s+/g, " ").trim().slice(0, 100) : ""))
      .filter((factId) => knownFactIds.has(factId)))];
    factIds.forEach((factId) => usedFactIds.add(factId));
    fullText += `${fullText ? " " : ""}${text}`;
    return {
      id: planned.slot,
      label: planned.label,
      range: `${planned.start}–${planned.end}s`,
      text,
      factIds,
    };
  });
  backfillFactIds(sections, usedFactIds, input);
  if (fullText.length > 30000) throw invalid("sections", "script_too_large");

  const expectedWords = meaningfulClaimWords(claim);
  const narrationWords = new Set((fullText.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []));
  const claimCoverage = expectedWords.length
    ? expectedWords.filter((word) => narrationWords.has(word)).length / expectedWords.length
    : 1;

  const estimatedSeconds = Math.max(1, Math.round(estimateSpeechSeconds(fullText, input.targetLanguage)));

  return {
    scriptId: `script_${fingerprint.slice(0, 20)}`,
    ...(mode === "revision" ? { supersedesScriptId: input.currentScript.scriptId } : {}),
    claim,
    claimStrategy: claimStrategy(input),
    usedFactIds: [...usedFactIds],
    title,
    version: mode === "revision" ? input.currentScript.version + 1 : 1,
    estimatedSeconds,
    claimCoverage,
    sections,
  };
}

module.exports = {
  createSectionPlan,
  durationToleranceSeconds,
  estimateSpeechSeconds,
  invalid,
  normalizeScript,
  parseScriptJSON,
  requestFingerprint,
};
