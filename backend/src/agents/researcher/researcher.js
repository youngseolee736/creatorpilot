const { resolveLLMConfig } = require("../../services/llm");
const { OpenAIWebResearchProvider } = require("../../services/research/openai-web-research-provider");
const { normalizeResearch, parseResearchJSON } = require("./normalize-research");
const {
  DIRECT_EVIDENCE_SYSTEM_PROMPT,
  NARRATIVE_CASE_SYSTEM_PROMPT,
  RESEARCH_JUDGE_SYSTEM_PROMPT,
  RESEARCH_OUTPUT_SCHEMA,
  RESEARCHER_SYSTEM_PROMPT,
  buildResearchJudgePrompt,
  buildResearchPrompt,
} = require("./researcher-prompt");
const { validateResearchRequest } = require("./researcher-schema");

class Researcher {
  constructor(options = {}) {
    const environment = options.environment || process.env;
    const createProvider = (prefix) => {
      const config = resolveLLMConfig(prefix, environment);
      const hasScopedTimeout = Boolean(environment[`${prefix}_LLM_TIMEOUT_MS`]);
      return new OpenAIWebResearchProvider({
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: hasScopedTimeout ? config.timeoutMs : Math.max(Number(config.timeoutMs) || 0, 300000),
        ...(options.providerOptions || {}),
      });
    };
    this.provider = options.provider || createProvider("RESEARCH");
    const roleProvider = (prefix, supplied) => {
      if (supplied) return supplied;
      const configured = ["PROVIDER", "API_BASE_URL", "API_KEY", "MODEL", "TIMEOUT_MS"]
        .some((field) => environment[`${prefix}_LLM_${field}`]);
      return configured ? createProvider(prefix) : this.provider;
    };
    this.candidateAProvider = roleProvider("RESEARCH_A", options.candidateAProvider);
    this.candidateBProvider = roleProvider("RESEARCH_B", options.candidateBProvider);
    this.judgeProvider = roleProvider("RESEARCH_JUDGE", options.judgeProvider);
    this.completed = new Map();
    this.maxCompleted = Number(options.maxCompleted) || 100;
  }

  async research(request) {
    const input = validateResearchRequest(request);
    const key = JSON.stringify(input);
    if (this.completed.has(key)) return this.completed.get(key);
    const run = async (provider, instructions, prompt) => {
      const response = await provider.research({ instructions, input: prompt, schema: RESEARCH_OUTPUT_SCHEMA });
      return normalizeResearch(parseResearchJSON(response.text), response.sources, input);
    };
    let result;
    if (input.analysisMode !== "deep") {
      result = await run(this.provider, RESEARCHER_SYSTEM_PROMPT, buildResearchPrompt(input));
    } else {
      const settled = await Promise.allSettled([
        run(this.candidateAProvider, DIRECT_EVIDENCE_SYSTEM_PROMPT, buildResearchPrompt(input)),
        run(this.candidateBProvider, NARRATIVE_CASE_SYSTEM_PROMPT, buildResearchPrompt(input)),
      ]);
      const candidates = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
      if (!candidates.length) throw settled[0].reason;
      const candidateMeta = candidates.map((candidate, index) => ({
        id: index === 0 && settled[0].status === "fulfilled" ? "candidate-a" : "candidate-b",
        focus: index === 0 && settled[0].status === "fulfilled" ? "Direct evidence" : "Narrative case",
        summary: candidate.summary,
      }));
      const localized = input.creativeBrief.language.toLowerCase().includes("korean");
      const attach = (pack, degraded, winner, reason) => ({
        ...pack,
        ensemble: { mode: "deep", candidates: candidateMeta, judgment: { winner, reason, confidence: degraded ? 0.72 : 0.9 }, degraded },
      });
      if (candidates.length === 1) {
        result = attach(candidates[0], true, candidateMeta[0].id, localized ? "한 후보가 중단되어 완료된 연구 결과를 사용했습니다." : "One candidate stopped, so the completed research pack was used.");
      } else {
        try {
          const judged = await run(this.judgeProvider, RESEARCH_JUDGE_SYSTEM_PROMPT, buildResearchJudgePrompt(input, candidates));
          result = attach(judged, false, "hybrid", localized ? "직접 비교 근거와 가장 강한 서사적 논리를 검증해 결합했습니다." : "Combined the strongest verified direct evidence with the strongest truthful narrative case.");
        } catch {
          result = attach(candidates[0], true, "candidate-a", localized ? "Research Judge가 중단되어 검증된 첫 번째 결과를 사용했습니다." : "The Research Judge stopped, so the first validated pack was used.");
        }
      }
    }
    if (this.completed.size >= this.maxCompleted) this.completed.delete(this.completed.keys().next().value);
    this.completed.set(key, result);
    return result;
  }
}

module.exports = { Researcher };
