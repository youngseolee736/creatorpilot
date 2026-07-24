const crypto = require("crypto");
const { AppError } = require("../../middleware/error-handler");

function invalid(field, reason) {
  return new AppError(502, "INVALID_RESEARCH_RESPONSE", "The Research Agent returned an invalid or ungrounded evidence pack.", true, [{ field, reason }]);
}

function parseResearchJSON(value) {
  if (typeof value !== "string") throw invalid("response", "malformed_json");
  try {
    const trimmed = value.trim();
    const json = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      : trimmed;
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw invalid("response", "malformed_json");
  }
}

function cleanText(value, field, max) {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) throw invalid(field, "required_string");
  return normalized.slice(0, max);
}

function sourceKey(value) {
  try { return new URL(value).href; } catch { return ""; }
}

function titleFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function collectModelSources(raw) {
  const urls = [];
  for (const fact of Array.isArray(raw?.facts) ? raw.facts : []) {
    for (const url of Array.isArray(fact?.sourceUrls) ? fact.sourceUrls : []) urls.push(url);
  }
  for (const url of Array.isArray(raw?.counterpoint?.sourceUrls) ? raw.counterpoint.sourceUrls : []) urls.push(url);
  return [...new Set(urls.map(sourceKey).filter((url) => {
    try { return new URL(url).protocol === "https:"; } catch { return false; }
  }))].map((url) => ({ url, title: titleFromUrl(url), providerVerified: false }));
}

function normalizeResearch(raw, providerSources, input) {
  const providerVerified = Array.isArray(providerSources) && providerSources.length > 0;
  const sourceCatalog = providerVerified ? providerSources : collectModelSources(raw);
  const allowed = new Map(sourceCatalog.map((source) => [sourceKey(source.url), source]).filter(([key]) => key));
  const usedUrls = new Set();
  const groundedUrls = (value, field) => {
    if (!Array.isArray(value)) return [];
    const urls = [...new Set(value.map(sourceKey).filter((url) => !allowed.size || allowed.has(url)))].slice(0, 2);
    urls.forEach((url) => usedUrls.add(url));
    return urls;
  };

  const summary = cleanText(raw.summary, "summary", 600);
  const verdictStatus = cleanText(raw.verdictStatus, "verdictStatus", 40);
  const safeVerdictStatus = ["supported", "partially_supported", "not_supported", "insufficient_evidence"].includes(verdictStatus)
    ? verdictStatus
    : "partially_supported";
  const recommendedFrame = cleanText(raw.recommendedFrame, "recommendedFrame", 240);
  const rawFacts = Array.isArray(raw.facts) ? raw.facts.slice(0, 5) : [];
  while (rawFacts.length < 3) {
    rawFacts.push({
      claim: rawFacts.length === 0 ? recommendedFrame : `Supporting point ${rawFacts.length + 1}`,
      explanation: summary,
      confidence: "medium",
      sourceUrls: [],
    });
  }
  const roles = ["opening", "context", "build", "reveal", "payoff"];
  const facts = rawFacts.map((fact, index) => {
    const safeFact = fact && typeof fact === "object" && !Array.isArray(fact) ? fact : {};
    const confidence = ["high", "medium", "low"].includes(safeFact.confidence) ? safeFact.confidence : "medium";
    return {
      factId: `fact_${index + 1}`,
      narrativeRole: roles[index],
      claim: cleanText(safeFact.claim || recommendedFrame, `facts.${index}.claim`, 500),
      explanation: cleanText(safeFact.explanation || summary, `facts.${index}.explanation`, 700),
      confidence,
      sourceUrls: groundedUrls(safeFact.sourceUrls, `facts.${index}.sourceUrls`),
      usableInScript: true,
    };
  });

  const rawCounterpoint = raw.counterpoint && typeof raw.counterpoint === "object" && !Array.isArray(raw.counterpoint)
    ? raw.counterpoint
    : {};
  const counterpoint = {
    claim: cleanText(rawCounterpoint.claim || "The evidence still needs editorial review.", "counterpoint.claim", 500),
    explanation: cleanText(rawCounterpoint.explanation || "Some supporting details may vary by context, source quality, or interpretation.", "counterpoint.explanation", 600),
    sourceUrls: groundedUrls(rawCounterpoint.sourceUrls, "counterpoint.sourceUrls"),
  };

  const sourceIndex = [...usedUrls];
  const sources = sourceIndex.map((url, index) => {
    const source = allowed.get(url);
    return {
      sourceId: `source_${index + 1}`,
      title: cleanText(source.title || new URL(url).hostname, `sources.${index}.title`, 300),
      url,
      domain: new URL(url).hostname,
    };
  });
  const sourceIds = (urls) => urls.map((url) => `source_${sourceIndex.indexOf(url) + 1}`);
  for (const fact of facts) fact.sourceIds = sourceIds(fact.sourceUrls);
  counterpoint.sourceIds = sourceIds(counterpoint.sourceUrls);

  const supportFactIds = facts.slice(0, Math.min(3, facts.length)).map((fact) => fact.factId);
  const mode = safeVerdictStatus === "supported" ? "direct"
    : safeVerdictStatus === "partially_supported" ? "reframe"
      : "unavailable";
  const storyFindings = facts.map((fact) => ({
    role: fact.narrativeRole,
    guidance: fact.claim,
    factIds: [fact.factId],
  }));
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ input, facts, sources })).digest("hex").slice(0, 20);
  return {
    researchId: `research_${fingerprint}`,
    summary,
    verdict: { status: safeVerdictStatus, headline: recommendedFrame, explanation: summary },
    narrativeCase: {
      mode,
      recommendedFrame,
      definition: recommendedFrame,
      thesis: summary,
      whyItProvesClaim: summary,
      concession: counterpoint.claim,
      supportFactIds,
    },
    criteria: [],
    comparisonSet: [],
    comparisons: [],
    facts,
    counterpoint,
    storyFindings,
    sources,
    openQuestions: [],
    searchedAt: new Date().toISOString(),
    safety: { providerVerifiedSources: providerVerified, factualGuarantee: false },
  };
}

module.exports = { normalizeResearch, parseResearchJSON };
