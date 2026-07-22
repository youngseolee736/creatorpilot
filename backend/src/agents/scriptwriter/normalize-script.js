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

function normalizeScript(raw, input, plan, mode, fingerprint) {
  const keys = Object.keys(raw);
  if (keys.some((key) => !["claim", "title", "sections"].includes(key))) throw invalid("response", "unexpected_field");
  const claim = stringField(raw.claim, "claim", 500);
  if (claim !== input.creativeBrief.topic) throw invalid("claim", "must_match_required_claim");
  const title = stringField(raw.title, "title", 180);
  if (!Array.isArray(raw.sections) || raw.sections.length !== plan.length) throw invalid("sections", "must_match_section_plan");

  let fullText = "";
  const knownFactIds = new Set(input.factPack.facts.map((fact) => fact.factId));
  const usedFactIds = new Set();
  const sections = raw.sections.map((section, index) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) throw invalid(`sections.${index}`, "invalid_object");
    if (Object.keys(section).some((key) => !["slot", "label", "text", "factIds"].includes(key))) {
      throw invalid(`sections.${index}`, "unexpected_field");
    }
    const slot = stringField(section.slot, `sections.${index}.slot`, 100);
    if (slot !== plan[index].slot) throw invalid(`sections.${index}.slot`, "must_match_section_plan");
    stringField(section.label, `sections.${index}.label`, 80);
    const text = stringField(section.text, `sections.${index}.text`, 6000);
    if (!Array.isArray(section.factIds) || section.factIds.length > 3) throw invalid(`sections.${index}.factIds`, "invalid_array");
    const factIds = section.factIds.map((factId, factIndex) => stringField(factId, `sections.${index}.factIds.${factIndex}`, 100));
    if (new Set(factIds).size !== factIds.length) throw invalid(`sections.${index}.factIds`, "duplicate_fact_id");
    if (factIds.some((factId) => !knownFactIds.has(factId))) throw invalid(`sections.${index}.factIds`, "unknown_fact");
    factIds.forEach((factId) => usedFactIds.add(factId));
    fullText += `${fullText ? " " : ""}${text}`;
    return {
      id: plan[index].slot,
      label: plan[index].label,
      range: `${plan[index].start}–${plan[index].end}s`,
      text,
      factIds,
    };
  });
  if (fullText.length > 30000) throw invalid("sections", "script_too_large");
  if (usedFactIds.size < 2) throw invalid("sections", "insufficient_fact_use");
  const narrativeFactIds = input.factPack.narrativeCase.supportFactIds;
  const requiredNarrativeFacts = Math.min(2, narrativeFactIds.length);
  const usedNarrativeFacts = narrativeFactIds.filter((factId) => usedFactIds.has(factId)).length;
  if (usedNarrativeFacts < requiredNarrativeFacts) throw invalid("sections", "insufficient_narrative_case_facts");

  const expectedWords = meaningfulClaimWords(claim);
  const narrationWords = new Set((fullText.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []));
  const requiredCoverage = Math.min(2, expectedWords.length);
  if (expectedWords.filter((word) => narrationWords.has(word)).length < requiredCoverage) {
    throw invalid("sections", "claim_not_expressed");
  }

  const estimatedSeconds = Math.max(1, Math.round(estimateSpeechSeconds(fullText, input.targetLanguage)));
  const tolerance = Math.max(2, Math.round(input.targetDurationSeconds * 0.03));
  if (Math.abs(estimatedSeconds - input.targetDurationSeconds) > tolerance) {
    throw invalid("estimatedSeconds", estimatedSeconds < input.targetDurationSeconds ? "script_too_short" : "script_too_long");
  }

  return {
    scriptId: `script_${fingerprint.slice(0, 20)}`,
    ...(mode === "revision" ? { supersedesScriptId: input.currentScript.scriptId } : {}),
    claim,
    claimStrategy: claimStrategy(input),
    usedFactIds: [...usedFactIds],
    title,
    version: mode === "revision" ? input.currentScript.version + 1 : 1,
    estimatedSeconds,
    sections,
  };
}

module.exports = {
  createSectionPlan,
  estimateSpeechSeconds,
  invalid,
  normalizeScript,
  parseScriptJSON,
  requestFingerprint,
};
