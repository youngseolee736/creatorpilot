const crypto = require("crypto");
const { AppError } = require("../../middleware/error-handler");

function invalid(field, reason) {
  return new AppError(502, "INVALID_RESEARCH_RESPONSE", "The Research Agent returned an invalid or ungrounded Fact Pack.", true, [{ field, reason }]);
}

function parseResearchJSON(value) {
  if (typeof value !== "string") throw invalid("response", "malformed_json");
  try {
    const parsed = JSON.parse(value.trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw invalid("response", "malformed_json");
  }
}

function cleanText(value, field, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw invalid(field, "required_string");
  return value.replace(/\s+/g, " ").trim();
}

function sourceKey(value) {
  try { return new URL(value).href; } catch { return ""; }
}

function normalizeResearch(raw, providerSources, input) {
  if (!Array.isArray(providerSources) || !providerSources.length) throw invalid("sources", "provider_sources_required");
  const allowed = new Map(providerSources.map((source) => [sourceKey(source.url), source]).filter(([key]) => key));
  if (!Array.isArray(raw.facts) || raw.facts.length < 3 || raw.facts.length > 8) throw invalid("facts", "invalid_array");
  const usedUrls = new Set();
  const facts = raw.facts.map((fact, index) => {
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) throw invalid(`facts.${index}`, "invalid_object");
    if (!["high", "medium", "low"].includes(fact.confidence)) throw invalid(`facts.${index}.confidence`, "invalid_enum");
    if (!Array.isArray(fact.sourceUrls) || !fact.sourceUrls.length || fact.sourceUrls.length > 4) throw invalid(`facts.${index}.sourceUrls`, "invalid_array");
    const urls = [...new Set(fact.sourceUrls.map(sourceKey).filter((url) => allowed.has(url)))];
    if (!urls.length) throw invalid(`facts.${index}.sourceUrls`, "not_in_provider_sources");
    urls.forEach((url) => usedUrls.add(url));
    return {
      factId: `fact_${index + 1}`,
      claim: cleanText(fact.claim, `facts.${index}.claim`, 500),
      explanation: cleanText(fact.explanation, `facts.${index}.explanation`, 900),
      confidence: fact.confidence,
      sourceIds: urls.map((url) => `source_${[...usedUrls].indexOf(url) + 1}`),
      sourceUrls: urls,
      usableInScript: true,
    };
  });
  const sourceIndex = [...usedUrls];
  const sources = sourceIndex.map((url, index) => {
    const source = allowed.get(url);
    return { sourceId: `source_${index + 1}`, title: cleanText(source.title || new URL(url).hostname, `sources.${index}.title`, 300), url, domain: new URL(url).hostname };
  });
  for (const fact of facts) fact.sourceIds = fact.sourceUrls.map((url) => `source_${sourceIndex.indexOf(url) + 1}`);
  const openQuestions = Array.isArray(raw.openQuestions)
    ? raw.openQuestions.slice(0, 5).map((item, index) => cleanText(item, `openQuestions.${index}`, 400))
    : [];
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ input, facts, sources })).digest("hex").slice(0, 20);
  return {
    researchId: `research_${fingerprint}`,
    summary: cleanText(raw.summary, "summary", 800),
    facts,
    sources,
    openQuestions,
    searchedAt: new Date().toISOString(),
    safety: { providerVerifiedSources: true, factualGuarantee: false },
  };
}

module.exports = { normalizeResearch, parseResearchJSON };

