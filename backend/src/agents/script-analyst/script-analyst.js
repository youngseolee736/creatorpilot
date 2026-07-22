const { createLLMProvider, resolveLLMConfig } = require("../../services/llm");
const { mapLLMError } = require("../../services/llm/llm-errors");
const { normalizeAnalysis, parseAnalysisJSON } = require("./normalize-analysis");
const {
  JSON_REPAIR_SYSTEM_PROMPT,
  SCRIPT_ANALYST_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  buildRepairUserPrompt,
  REFERENCE_SYNTHESIS_SYSTEM_PROMPT,
  SYNTHESIS_REPAIR_SYSTEM_PROMPT,
  buildSynthesisUserPrompt,
  buildSynthesisRepairPrompt,
  HOOK_CANDIDATE_SYSTEM_PROMPT,
  FLOW_CANDIDATE_SYSTEM_PROMPT,
  SYNTHESIS_JUDGE_SYSTEM_PROMPT,
} = require("./script-analyst-prompt");
const { validateAnalysisRequest, validateSynthesisRequest } = require("./script-analyst-schema");

class ScriptAnalyst {
  constructor(options = {}) {
    const environment = options.llmOptions?.environment || process.env;
    const config = resolveLLMConfig("ANALYST", environment);
    const hasScopedTimeout = Boolean(environment.ANALYST_LLM_TIMEOUT_MS);
    this.provider = options.provider || createLLMProvider({
      ...(options.llmOptions || {}),
      envPrefix: "ANALYST",
      agentLabel: "Script Analyst",
      unsupportedErrorCode: "ANALYSIS_INTERNAL_ERROR",
      openAICompatibleOptions: {
        timeoutMs: hasScopedTimeout ? config.timeoutMs : Math.max(Number(config.timeoutMs) || 0, 300000),
        ...(options.llmOptions?.openAICompatibleOptions || {}),
      },
    });
    const roleProvider = (prefix, supplied) => {
      if (supplied) return supplied;
      const hasRoleConfig = ["PROVIDER", "API_BASE_URL", "API_KEY", "MODEL", "TIMEOUT_MS"]
        .some((field) => environment[`${prefix}_LLM_${field}`]);
      if (!hasRoleConfig) return this.provider;
      const roleConfig = resolveLLMConfig(prefix, environment);
      const hasRoleTimeout = Boolean(environment[`${prefix}_LLM_TIMEOUT_MS`]);
      return createLLMProvider({
        ...(options.llmOptions || {}),
        envPrefix: prefix,
        agentLabel: "Script Analyst",
        unsupportedErrorCode: "ANALYSIS_INTERNAL_ERROR",
        openAICompatibleOptions: {
          timeoutMs: hasRoleTimeout ? roleConfig.timeoutMs : Math.max(Number(roleConfig.timeoutMs) || 0, 300000),
          ...(options.llmOptions?.openAICompatibleOptions || {}),
        },
      });
    };
    this.candidateAProvider = roleProvider("ANALYST_A", options.candidateAProvider);
    this.candidateBProvider = roleProvider("ANALYST_B", options.candidateBProvider);
    this.judgeProvider = roleProvider("ANALYST_JUDGE", options.judgeProvider);
  }

  async providerComplete(messages, provider = this.provider) {
    try {
      return await provider.complete(messages);
    } catch (error) {
      throw mapLLMError(error);
    }
  }

  async analyze(request) {
    const input = validateAnalysisRequest(request);
    const raw = await this.providerComplete([
      { role: "system", content: SCRIPT_ANALYST_SYSTEM_PROMPT },
      { role: "user", content: buildAnalysisUserPrompt(input) },
    ]);

    try {
      return normalizeAnalysis(parseAnalysisJSON(raw), input);
    } catch (error) {
      if (error?.code !== "INVALID_LLM_RESPONSE") throw error;
      const repaired = await this.providerComplete([
        { role: "system", content: JSON_REPAIR_SYSTEM_PROMPT },
        { role: "user", content: buildRepairUserPrompt(raw, error, input) },
      ]);
      return normalizeAnalysis(parseAnalysisJSON(repaired), input);
    }
  }

  async synthesize(request) {
    const input = validateSynthesisRequest(request);
    const normalizationInput = {
      projectId: `${input.projectId}_synthesis`,
      targetTopic: input.targetTopic,
      targetDurationSeconds: input.targetDurationSeconds,
      analysisLanguage: input.analysisLanguage,
      transcript: { text: "abstract source set", estimatedDuration: input.targetDurationSeconds },
    };
    const finish = (candidate, suffix = "") => {
      const parsed = parseAnalysisJSON(candidate);
      const normalized = normalizeAnalysis(parsed, normalizationInput);
      return {
        ...normalized,
        analysisId: `synthesis_${input.projectId}${suffix}`,
        referenceCount: input.analyses.length,
        sourceAnalysisIds: input.analyses.map((item) => item.analysis.analysisId),
        synthesis: {
          sharedPatterns: normalized.reusablePatterns,
          distinctStrengths: [...new Set(input.analyses.map((item) => item.analysis.hookType).filter(Boolean))].slice(0, 3),
        },
      };
    };
    const completeBlueprint = async (provider, systemPrompt, payload, suffix) => {
      const raw = await this.providerComplete([
        { role: "system", content: systemPrompt },
        { role: "user", content: buildSynthesisUserPrompt(payload) },
      ], provider);
      try {
        return finish(raw, suffix);
      } catch (error) {
        if (error?.code !== "INVALID_LLM_RESPONSE") throw error;
        const repaired = await this.providerComplete([
          { role: "system", content: SYNTHESIS_REPAIR_SYSTEM_PROMPT },
          { role: "user", content: buildSynthesisRepairPrompt(raw, error, payload) },
        ], provider);
        return finish(repaired, suffix);
      }
    };
    if (input.analysisMode !== "deep") {
      return completeBlueprint(this.provider, REFERENCE_SYNTHESIS_SYSTEM_PROMPT, input, "");
    }

    const candidateResults = await Promise.allSettled([
      completeBlueprint(this.candidateAProvider, HOOK_CANDIDATE_SYSTEM_PROMPT, input, "_candidate_a"),
      completeBlueprint(this.candidateBProvider, FLOW_CANDIDATE_SYSTEM_PROMPT, input, "_candidate_b"),
    ]);
    const candidates = candidateResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
    if (!candidates.length) throw candidateResults[0].reason;
    const candidateMeta = candidates.map((candidate) => ({
      id: candidate.analysisId.endsWith("candidate_a") ? "candidate-a" : "candidate-b",
      focus: candidate.analysisId.endsWith("candidate_a") ? "Hook and retention" : "Flow and clarity",
      summary: candidate.summary,
    }));
    const localized = input.analysisLanguage.toLowerCase().includes("korean");
    const attachEnsemble = (blueprint, { degraded, winner, reason }) => ({
      ...blueprint,
      analysisId: `synthesis_${input.projectId}`,
      ensemble: {
        mode: "deep",
        candidates: candidateMeta,
        judgment: {
          winner,
          reason,
          confidence: degraded ? 0.72 : Math.min(0.99, Math.max(0, blueprint.confidence)),
        },
        degraded,
      },
    });
    if (candidates.length === 1) {
      return attachEnsemble(candidates[0], {
        degraded: true,
        winner: candidateMeta[0].id,
        reason: localized ? "한 후보가 중단되어 완료된 유효 결과를 사용했습니다." : "One candidate stopped, so the completed valid blueprint was used.",
      });
    }
    try {
      const judged = await completeBlueprint(
        this.judgeProvider,
        SYNTHESIS_JUDGE_SYSTEM_PROMPT,
        { ...input, candidates },
        "_judge",
      );
      return attachEnsemble(judged, {
        degraded: false,
        winner: "hybrid",
        reason: localized ? "A의 강한 도입과 B의 명확한 전개를 근거에 맞게 결합했습니다." : "Combined Candidate A's stronger opening with Candidate B's clearer evidence flow.",
      });
    } catch {
      return attachEnsemble(candidates[0], {
        degraded: true,
        winner: "candidate-a",
        reason: localized ? "Judge가 중단되어 검증을 통과한 첫 번째 후보를 사용했습니다." : "The Judge stopped, so the first validated candidate was used.",
      });
    }
  }
}

module.exports = { ScriptAnalyst };
