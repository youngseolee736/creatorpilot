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

function cleanList(value, field, { min = 0, max = 8, maxLength = 400 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw invalid(field, "invalid_array");
  return value.map((item, index) => cleanText(item, `${field}.${index}`, maxLength));
}

function normalizeResearch(raw, providerSources, input) {
  if (!Array.isArray(providerSources) || !providerSources.length) throw invalid("sources", "provider_sources_required");
  const allowed = new Map(providerSources.map((source) => [sourceKey(source.url), source]).filter(([key]) => key));
  const usedUrls = new Set();
  const groundedUrls = (value, field) => {
    if (!Array.isArray(value) || !value.length || value.length > 4) throw invalid(field, "invalid_array");
    const urls = [...new Set(value.map(sourceKey).filter((url) => allowed.has(url)))];
    if (!urls.length) throw invalid(field, "not_in_provider_sources");
    urls.forEach((url) => usedUrls.add(url));
    return urls;
  };

  if (!raw.verdict || typeof raw.verdict !== "object" || Array.isArray(raw.verdict)) throw invalid("verdict", "invalid_object");
  if (!["supported", "partially_supported", "not_supported", "insufficient_evidence"].includes(raw.verdict.status)) {
    throw invalid("verdict.status", "invalid_enum");
  }
  const verdict = {
    status: raw.verdict.status,
    headline: cleanText(raw.verdict.headline, "verdict.headline", 300),
    explanation: cleanText(raw.verdict.explanation, "verdict.explanation", 600),
  };
  if (!raw.narrativeCase || typeof raw.narrativeCase !== "object" || Array.isArray(raw.narrativeCase)) throw invalid("narrativeCase", "invalid_object");
  if (!["direct", "reframe", "unavailable"].includes(raw.narrativeCase.mode)) throw invalid("narrativeCase.mode", "invalid_enum");
  const criteria = cleanList(raw.criteria, "criteria", { min: 2, max: 5, maxLength: 120 });
  const comparisonSet = cleanList(raw.comparisonSet, "comparisonSet", { min: 1, max: 6, maxLength: 120 });

  if (!Array.isArray(raw.comparisons) || raw.comparisons.length > 6) throw invalid("comparisons", "invalid_array");
  const comparisons = raw.comparisons.map((comparison, index) => {
    if (!comparison || typeof comparison !== "object" || Array.isArray(comparison)) throw invalid(`comparisons.${index}`, "invalid_object");
    return {
      metric: cleanText(comparison.metric, `comparisons.${index}.metric`, 160),
      subject: cleanText(comparison.subject, `comparisons.${index}.subject`, 120),
      subjectValue: cleanText(comparison.subjectValue, `comparisons.${index}.subjectValue`, 120),
      benchmark: cleanText(comparison.benchmark, `comparisons.${index}.benchmark`, 120),
      benchmarkValue: cleanText(comparison.benchmarkValue, `comparisons.${index}.benchmarkValue`, 120),
      interpretation: cleanText(comparison.interpretation, `comparisons.${index}.interpretation`, 400),
      sourceUrls: groundedUrls(comparison.sourceUrls, `comparisons.${index}.sourceUrls`),
    };
  });

  if (!Array.isArray(raw.facts) || raw.facts.length < 3 || raw.facts.length > 8) throw invalid("facts", "invalid_array");
  const facts = raw.facts.map((fact, index) => {
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) throw invalid(`facts.${index}`, "invalid_object");
    if (!["high", "medium", "low"].includes(fact.confidence)) throw invalid(`facts.${index}.confidence`, "invalid_enum");
    if (!["opening", "context", "build", "reveal", "payoff", "counterpoint"].includes(fact.narrativeRole)) throw invalid(`facts.${index}.narrativeRole`, "invalid_enum");
    const urls = groundedUrls(fact.sourceUrls, `facts.${index}.sourceUrls`);
    return {
      factId: `fact_${index + 1}`,
      narrativeRole: fact.narrativeRole,
      claim: cleanText(fact.claim, `facts.${index}.claim`, 500),
      explanation: cleanText(fact.explanation, `facts.${index}.explanation`, 900),
      confidence: fact.confidence,
      sourceUrls: urls,
      usableInScript: true,
    };
  });

  if (!Array.isArray(raw.narrativeCase.supportFactNumbers) || raw.narrativeCase.supportFactNumbers.length < 2 || raw.narrativeCase.supportFactNumbers.length > 4) {
    throw invalid("narrativeCase.supportFactNumbers", "invalid_array");
  }
  const supportFactNumbers = [...new Set(raw.narrativeCase.supportFactNumbers.map(Number))];
  if (supportFactNumbers.length < 2 || supportFactNumbers.some((number) => !Number.isInteger(number) || number < 1 || number > facts.length)) {
    throw invalid("narrativeCase.supportFactNumbers", "unknown_fact");
  }
  const narrativeCase = {
    mode: raw.narrativeCase.mode,
    recommendedFrame: cleanText(raw.narrativeCase.recommendedFrame, "narrativeCase.recommendedFrame", 240),
    definition: cleanText(raw.narrativeCase.definition, "narrativeCase.definition", 300),
    thesis: cleanText(raw.narrativeCase.thesis, "narrativeCase.thesis", 400),
    whyItProvesClaim: cleanText(raw.narrativeCase.whyItProvesClaim, "narrativeCase.whyItProvesClaim", 600),
    concession: cleanText(raw.narrativeCase.concession, "narrativeCase.concession", 400),
    supportFactIds: supportFactNumbers.map((number) => `fact_${number}`),
  };

  if (!raw.counterpoint || typeof raw.counterpoint !== "object" || Array.isArray(raw.counterpoint)) throw invalid("counterpoint", "invalid_object");
  const counterpoint = {
    claim: cleanText(raw.counterpoint.claim, "counterpoint.claim", 500),
    explanation: cleanText(raw.counterpoint.explanation, "counterpoint.explanation", 700),
    sourceUrls: groundedUrls(raw.counterpoint.sourceUrls, "counterpoint.sourceUrls"),
  };

  if (!Array.isArray(raw.storyFindings) || raw.storyFindings.length < 3 || raw.storyFindings.length > 5) {
    throw invalid("storyFindings", "invalid_array");
  }
  const seenRoles = new Set();
  const storyFindings = raw.storyFindings.map((finding, index) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) throw invalid(`storyFindings.${index}`, "invalid_object");
    if (!["opening", "context", "build", "reveal", "payoff"].includes(finding.role) || seenRoles.has(finding.role)) {
      throw invalid(`storyFindings.${index}.role`, "invalid_or_duplicate_role");
    }
    seenRoles.add(finding.role);
    if (!Array.isArray(finding.factNumbers) || !finding.factNumbers.length || finding.factNumbers.length > 3) {
      throw invalid(`storyFindings.${index}.factNumbers`, "invalid_array");
    }
    const factNumbers = [...new Set(finding.factNumbers.map(Number))];
    if (factNumbers.some((number) => !Number.isInteger(number) || number < 1 || number > facts.length)) {
      throw invalid(`storyFindings.${index}.factNumbers`, "unknown_fact");
    }
    return {
      role: finding.role,
      guidance: cleanText(finding.guidance, `storyFindings.${index}.guidance`, 400),
      factIds: factNumbers.map((number) => `fact_${number}`),
    };
  });

  const sourceIndex = [...usedUrls];
  const sources = sourceIndex.map((url, index) => {
    const source = allowed.get(url);
    return { sourceId: `source_${index + 1}`, title: cleanText(source.title || new URL(url).hostname, `sources.${index}.title`, 300), url, domain: new URL(url).hostname };
  });
  const sourceIds = (urls) => urls.map((url) => `source_${sourceIndex.indexOf(url) + 1}`);
  for (const fact of facts) fact.sourceIds = sourceIds(fact.sourceUrls);
  for (const comparison of comparisons) comparison.sourceIds = sourceIds(comparison.sourceUrls);
  counterpoint.sourceIds = sourceIds(counterpoint.sourceUrls);
  const openQuestions = Array.isArray(raw.openQuestions)
    ? raw.openQuestions.slice(0, 5).map((item, index) => cleanText(item, `openQuestions.${index}`, 400))
    : [];
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ input, facts, sources })).digest("hex").slice(0, 20);
  return {
    researchId: `research_${fingerprint}`,
    summary: cleanText(raw.summary, "summary", 800),
    verdict,
    narrativeCase,
    criteria,
    comparisonSet,
    comparisons,
    facts,
    counterpoint,
    storyFindings,
    sources,
    openQuestions,
    searchedAt: new Date().toISOString(),
    safety: { providerVerifiedSources: true, factualGuarantee: false },
  };
}

module.exports = { normalizeResearch, parseResearchJSON };
