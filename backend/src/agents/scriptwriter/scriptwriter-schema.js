const { AppError } = require("../../middleware/error-handler");
const { normalizeCreativeBrief, normalizeReferenceBlueprint, plainObject } = require("../../contracts/creative-input");
const { validLanguage } = require("../script-analyst/script-analyst-schema");

const MIN_TARGET_DURATION = 15;
const MAX_TARGET_DURATION = 180;
const MAX_SCRIPT_CHARACTERS = 30000;
const TOP_LEVEL_FIELDS = new Set(["projectId", "creativeBrief", "referenceBlueprint", "factPack", "targetLanguage", "targetDurationSeconds", "currentScript", "revisionInstructions", "preserveSectionIds", "analysisMode"]);

function detail(field, reason) { return [{ field, reason }]; }
function invalid(field, reason, message = "The Scriptwriter brief is invalid.") { throw new AppError(400, "INVALID_SCRIPT_BRIEF", message, false, detail(field, reason)); }
function requiredString(value, field, { min = 1, max = 500 } = {}) {
  if (typeof value !== "string") invalid(field, "required");
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < min || normalized.length > max) invalid(field, "invalid_length");
  return normalized;
}
function stringArray(value, field, { minItems = 0, maxItems = 12, maxLength = 500 } = {}) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) invalid(field, "invalid_array");
  return value.map((item, index) => requiredString(item, `${field}.${index}`, { max: maxLength }));
}
function normalizedUrl(value, field) {
  try { const url = new URL(value); if (url.protocol !== "https:") throw new Error(); return url.href; } catch { invalid(field, "invalid_url"); }
}

function normalizeFactPack(value) {
  if (!plainObject(value)) invalid("factPack", "required");
  if (!Array.isArray(value.sources) || !value.sources.length || value.sources.length > 24) invalid("factPack.sources", "invalid_array");
  const sources = value.sources.map((source, index) => ({
    sourceId: requiredString(source?.sourceId, `factPack.sources.${index}.sourceId`, { max: 100 }),
    title: requiredString(source?.title, `factPack.sources.${index}.title`, { max: 300 }),
    url: normalizedUrl(source?.url, `factPack.sources.${index}.url`),
    domain: requiredString(source?.domain, `factPack.sources.${index}.domain`, { max: 200 }),
  }));
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  if (sourceIds.size !== sources.length) invalid("factPack.sources", "duplicate_source_id");
  if (!Array.isArray(value.facts) || value.facts.length < 3 || value.facts.length > 8) invalid("factPack.facts", "invalid_array");
  const facts = value.facts.map((fact, index) => {
    const ids = stringArray(fact?.sourceIds, `factPack.facts.${index}.sourceIds`, { minItems: 1, maxItems: 4, maxLength: 100 });
    if (ids.some((id) => !sourceIds.has(id))) invalid(`factPack.facts.${index}.sourceIds`, "unknown_source");
    if (!["high", "medium", "low"].includes(fact?.confidence)) invalid(`factPack.facts.${index}.confidence`, "invalid_enum");
    if (fact.usableInScript !== true) invalid(`factPack.facts.${index}.usableInScript`, "must_be_true");
    const narrativeRole = fact.narrativeRole || "evidence";
    if (!["opening", "context", "build", "reveal", "payoff", "counterpoint", "evidence"].includes(narrativeRole)) invalid(`factPack.facts.${index}.narrativeRole`, "invalid_enum");
    return { factId: requiredString(fact.factId, `factPack.facts.${index}.factId`, { max: 100 }), narrativeRole, claim: requiredString(fact.claim, `factPack.facts.${index}.claim`, { max: 500 }), explanation: requiredString(fact.explanation, `factPack.facts.${index}.explanation`, { max: 900 }), confidence: fact.confidence, sourceIds: ids, usableInScript: true };
  });
  const factIds = new Set(facts.map((fact) => fact.factId));
  const storyFindings = Array.isArray(value.storyFindings) ? value.storyFindings.map((finding, index) => {
    const role = requiredString(finding?.role, `factPack.storyFindings.${index}.role`, { max: 40 });
    if (!["opening", "context", "build", "reveal", "payoff"].includes(role)) invalid(`factPack.storyFindings.${index}.role`, "invalid_enum");
    const ids = stringArray(finding?.factIds, `factPack.storyFindings.${index}.factIds`, { minItems: 1, maxItems: 3, maxLength: 100 });
    if (ids.some((id) => !factIds.has(id))) invalid(`factPack.storyFindings.${index}.factIds`, "unknown_fact");
    return { role, guidance: requiredString(finding.guidance, `factPack.storyFindings.${index}.guidance`, { max: 400 }), factIds: ids };
  }) : [];
  const summary = requiredString(value.summary, "factPack.summary", { max: 800 });
  const verdict = plainObject(value.verdict)
    ? {
      status: requiredString(value.verdict.status, "factPack.verdict.status", { max: 40 }),
      headline: requiredString(value.verdict.headline, "factPack.verdict.headline", { max: 300 }),
      explanation: requiredString(value.verdict.explanation, "factPack.verdict.explanation", { max: 600 }),
    }
    : { status: "insufficient_evidence", headline: summary, explanation: "No structured verdict was supplied." };
  if (!["supported", "partially_supported", "not_supported", "insufficient_evidence"].includes(verdict.status)) invalid("factPack.verdict.status", "invalid_enum");
  const narrativeCase = plainObject(value.narrativeCase)
    ? {
      mode: requiredString(value.narrativeCase.mode, "factPack.narrativeCase.mode", { max: 20 }),
      recommendedFrame: requiredString(value.narrativeCase.recommendedFrame, "factPack.narrativeCase.recommendedFrame", { max: 240 }),
      definition: requiredString(value.narrativeCase.definition, "factPack.narrativeCase.definition", { max: 300 }),
      thesis: requiredString(value.narrativeCase.thesis, "factPack.narrativeCase.thesis", { max: 400 }),
      whyItProvesClaim: requiredString(value.narrativeCase.whyItProvesClaim, "factPack.narrativeCase.whyItProvesClaim", { max: 600 }),
      concession: requiredString(value.narrativeCase.concession, "factPack.narrativeCase.concession", { max: 400 }),
      supportFactIds: stringArray(value.narrativeCase.supportFactIds, "factPack.narrativeCase.supportFactIds", { minItems: 2, maxItems: 4, maxLength: 100 }),
    }
    : { mode: verdict.status === "supported" ? "direct" : "unavailable", recommendedFrame: verdict.headline, definition: "Use the conventional meaning of the claim.", thesis: summary, whyItProvesClaim: verdict.explanation, concession: verdict.explanation, supportFactIds: facts.slice(0, 2).map((fact) => fact.factId) };
  if (!["direct", "reframe", "unavailable"].includes(narrativeCase.mode)) invalid("factPack.narrativeCase.mode", "invalid_enum");
  if (narrativeCase.supportFactIds.some((id) => !factIds.has(id))) invalid("factPack.narrativeCase.supportFactIds", "unknown_fact");
  return { researchId: requiredString(value.researchId, "factPack.researchId", { max: 160 }), summary, verdict, narrativeCase, criteria: stringArray(value.criteria || [], "factPack.criteria", { maxItems: 5, maxLength: 120 }), facts, sources, storyFindings, openQuestions: stringArray(value.openQuestions || [], "factPack.openQuestions", { maxItems: 5, maxLength: 400 }) };
}

function normalizeCurrentScript(value) {
  if (!plainObject(value)) invalid("currentScript", "required");
  if (!Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 12) invalid("currentScript.sections", "invalid_array");
  let totalCharacters = 0;
  const sections = value.sections.map((section, index) => {
    const scriptText = requiredString(section?.text, `currentScript.sections.${index}.text`, { max: 6000 }); totalCharacters += scriptText.length;
    const range = requiredString(section?.range, `currentScript.sections.${index}.range`, { max: 32 });
    if (!/^\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?s$/u.test(range)) invalid(`currentScript.sections.${index}.range`, "invalid_range");
    return { id: requiredString(section.id, `currentScript.sections.${index}.id`, { max: 100 }), label: requiredString(section.label, `currentScript.sections.${index}.label`, { max: 80 }), range, text: scriptText };
  });
  if (totalCharacters > MAX_SCRIPT_CHARACTERS) invalid("currentScript", "too_large");
  const version = Number(value.version); if (!Number.isInteger(version) || version < 1 || version > 10000) invalid("currentScript.version", "invalid");
  return { scriptId: requiredString(value.scriptId, "currentScript.scriptId", { max: 160 }), title: requiredString(value.title, "currentScript.title", { max: 180 }), version, estimatedSeconds: Number(value.estimatedSeconds) || null, sections };
}

function validateScriptRequest(request, { revision = false } = {}) {
  if (!plainObject(request)) invalid("request", "invalid_object", "The script request must be a JSON object.");
  if (Object.prototype.hasOwnProperty.call(request, "transcript")) invalid("transcript", "prohibited");
  const unexpected = Object.keys(request).find((field) => !TOP_LEVEL_FIELDS.has(field)); if (unexpected) invalid(unexpected, "unexpected_field");
  const projectId = requiredString(request.projectId, "projectId", { max: 128 });
  let creativeBrief; let referenceBlueprint;
  try { creativeBrief = normalizeCreativeBrief(request.creativeBrief, { code: "INVALID_SCRIPT_BRIEF" }); referenceBlueprint = normalizeReferenceBlueprint(request.referenceBlueprint, { code: "INVALID_SCRIPT_BRIEF" }); }
  catch (error) { if (error instanceof AppError) throw new AppError(400, "INVALID_SCRIPT_BRIEF", error.message, false, error.details); throw error; }
  const factPack = normalizeFactPack(request.factPack);
  const targetLanguage = requiredString(request.targetLanguage, "targetLanguage", { min: 2, max: 64 });
  if (!validLanguage(targetLanguage) || targetLanguage !== creativeBrief.language) invalid("targetLanguage", "must_match_creative_brief");
  const targetDurationSeconds = Number(request.targetDurationSeconds);
  if (!Number.isInteger(targetDurationSeconds) || targetDurationSeconds < MIN_TARGET_DURATION || targetDurationSeconds > MAX_TARGET_DURATION) invalid("targetDurationSeconds", "unsupported");
  const analysisMode = request.analysisMode == null ? "standard" : String(request.analysisMode).trim().toLowerCase();
  if (!["standard", "deep"].includes(analysisMode)) invalid("analysisMode", "invalid_enum");
  if (revision && (!Array.isArray(request.revisionInstructions) || !request.revisionInstructions.length)) throw new AppError(400, "REVISION_INSTRUCTIONS_REQUIRED", "At least one revision instruction is required.", false);
  const revisionInstructions = stringArray(request.revisionInstructions || [], "revisionInstructions", { maxItems: 12, maxLength: 500 });
  const currentScript = revision ? normalizeCurrentScript(request.currentScript) : null;
  if (!revision && request.currentScript != null) invalid("currentScript", "not_allowed_for_initial_draft");
  return { projectId, topic: creativeBrief.topic, targetLanguage, targetDurationSeconds, audience: creativeBrief.targetAudience, creativeBrief, referenceBlueprint, factPack, currentScript, revisionInstructions, preserveSectionIds: revision ? request.preserveSectionIds !== false : false, analysisMode };
}

module.exports = { MAX_SCRIPT_CHARACTERS, MAX_TARGET_DURATION, MIN_TARGET_DURATION, validateScriptRequest };
