const { createLLMProvider, resolveLLMConfig } = require("../../services/llm");
const { mapLLMError } = require("../../services/llm/llm-errors");
const {
  createSectionPlan,
  normalizeScript,
  parseScriptJSON,
  requestFingerprint,
} = require("./normalize-script");
const {
  EVIDENCE_CANDIDATE_SYSTEM_PROMPT,
  SCRIPT_REPAIR_SYSTEM_PROMPT,
  SCRIPT_JUDGE_SYSTEM_PROMPT,
  SCRIPTWRITER_SYSTEM_PROMPT,
  STORY_CANDIDATE_SYSTEM_PROMPT,
  buildScriptJudgePrompt,
  buildScriptRepairPrompt,
  buildScriptUserPrompt,
} = require("./scriptwriter-prompt");
const { validateScriptRequest } = require("./scriptwriter-schema");

class Scriptwriter {
  constructor(options = {}) {
    const environment = options.llmOptions?.environment || process.env;
    const config = resolveLLMConfig("SCRIPTWRITER", environment);
    const hasScopedTimeout = Boolean(environment.SCRIPTWRITER_LLM_TIMEOUT_MS);
    this.provider = options.provider || createLLMProvider({
      ...(options.llmOptions || {}),
      envPrefix: "SCRIPTWRITER",
      agentLabel: "Scriptwriter",
      unsupportedErrorCode: "SCRIPT_INTERNAL_ERROR",
      openAICompatibleOptions: {
        timeoutMs: hasScopedTimeout ? config.timeoutMs : Math.max(Number(config.timeoutMs) || 0, 300000),
        ...(options.llmOptions?.openAICompatibleOptions || {}),
      },
    });
    const roleProvider = (prefix, supplied) => {
      if (supplied) return supplied;
      const configured = ["PROVIDER", "API_BASE_URL", "API_KEY", "MODEL", "TIMEOUT_MS"]
        .some((field) => environment[`${prefix}_LLM_${field}`]);
      if (!configured) return this.provider;
      const roleConfig = resolveLLMConfig(prefix, environment);
      const hasRoleTimeout = Boolean(environment[`${prefix}_LLM_TIMEOUT_MS`]);
      return createLLMProvider({
        ...(options.llmOptions || {}),
        envPrefix: prefix,
        agentLabel: "Scriptwriter",
        unsupportedErrorCode: "SCRIPT_INTERNAL_ERROR",
        openAICompatibleOptions: {
          timeoutMs: hasRoleTimeout ? roleConfig.timeoutMs : Math.max(Number(roleConfig.timeoutMs) || 0, 300000),
          ...(options.llmOptions?.openAICompatibleOptions || {}),
        },
      });
    };
    this.candidateAProvider = roleProvider("SCRIPTWRITER_A", options.candidateAProvider);
    this.candidateBProvider = roleProvider("SCRIPTWRITER_B", options.candidateBProvider);
    this.judgeProvider = roleProvider("SCRIPTWRITER_JUDGE", options.judgeProvider);
    this.completed = new Map();
    this.inFlight = new Map();
    this.maxCompleted = Number(options.maxCompleted) || 100;
  }

  async providerComplete(messages, provider = this.provider) {
    try {
      return await provider.complete(messages);
    } catch (error) {
      throw mapLLMError(error, "Scriptwriter");
    }
  }

  remember(key, value) {
    if (this.completed.size >= this.maxCompleted) {
      this.completed.delete(this.completed.keys().next().value);
    }
    this.completed.set(key, value);
  }

  async write(input, mode) {
    const fingerprint = requestFingerprint(input, mode);
    if (this.completed.has(fingerprint)) return this.completed.get(fingerprint);
    if (this.inFlight.has(fingerprint)) return this.inFlight.get(fingerprint);

    const operation = (input.analysisMode === "deep"
      ? this.generateDeep(input, mode, fingerprint)
      : this.generateCandidate(input, mode, fingerprint))
      .then((result) => {
        this.remember(fingerprint, result);
        return result;
      })
      .finally(() => this.inFlight.delete(fingerprint));
    this.inFlight.set(fingerprint, operation);
    return operation;
  }

  async generateCandidate(input, mode, fingerprint, provider = this.provider, systemPrompt = SCRIPTWRITER_SYSTEM_PROMPT, userPrompt = null) {
    const sectionPlan = createSectionPlan(input);
    const options = { revision: mode === "revision" };
    let raw = await this.providerComplete([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt || buildScriptUserPrompt(input, sectionPlan, options) },
    ], provider);
    let validationError;
    for (let repairAttempt = 0; repairAttempt <= 2; repairAttempt += 1) {
      try {
        return normalizeScript(parseScriptJSON(raw), input, sectionPlan, mode, fingerprint);
      } catch (error) {
        validationError = error;
      }
      if (repairAttempt === 2) break;
      raw = await this.providerComplete([
        { role: "system", content: SCRIPT_REPAIR_SYSTEM_PROMPT },
        { role: "user", content: buildScriptRepairPrompt(raw, validationError, input, sectionPlan, options) },
      ], provider);
    }
    throw validationError;
  }

  async generateDeep(input, mode, fingerprint) {
    const settled = await Promise.allSettled([
      this.generateCandidate(input, mode, `${fingerprint}:candidate-a`, this.candidateAProvider, STORY_CANDIDATE_SYSTEM_PROMPT),
      this.generateCandidate(input, mode, `${fingerprint}:candidate-b`, this.candidateBProvider, EVIDENCE_CANDIDATE_SYSTEM_PROMPT),
    ]);
    const candidates = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
    if (!candidates.length) throw settled[0].reason;
    const candidateMeta = candidates.map((candidate, index) => ({
      id: index === 0 && settled[0].status === "fulfilled" ? "candidate-a" : "candidate-b",
      focus: index === 0 && settled[0].status === "fulfilled" ? "Story and retention" : "Evidence and clarity",
      summary: candidate.title,
    }));
    const localized = input.targetLanguage.toLowerCase().includes("korean");
    const attach = (script, degraded, winner, reason) => ({
      ...script,
      scriptId: `script_${fingerprint.slice(0, 20)}`,
      ensemble: { mode: "deep", candidates: candidateMeta, judgment: { winner, reason, confidence: degraded ? 0.72 : 0.9 }, degraded },
    });
    if (candidates.length === 1) {
      return attach(candidates[0], true, candidateMeta[0].id, localized ? "한 초안이 중단되어 완료된 유효 초안을 사용했습니다." : "One draft stopped, so the completed valid draft was used.");
    }
    try {
      const sectionPlan = createSectionPlan(input);
      const options = { revision: mode === "revision" };
      const judged = await this.generateCandidate(
        input,
        mode,
        fingerprint,
        this.judgeProvider,
        SCRIPT_JUDGE_SYSTEM_PROMPT,
        buildScriptJudgePrompt(input, sectionPlan, options, candidates),
      );
      return attach(judged, false, "hybrid", localized ? "A의 강한 이야기 흐름과 B의 명확한 근거 전개를 결합했습니다." : "Combined Candidate A's stronger story momentum with Candidate B's clearer evidence flow.");
    } catch {
      return attach(candidates[0], true, "candidate-a", localized ? "Writing Judge가 중단되어 검증된 첫 번째 초안을 사용했습니다." : "The Writing Judge stopped, so the first validated draft was used.");
    }
  }

  generate(request) {
    return this.write(validateScriptRequest(request), "generation");
  }

  revise(request) {
    return this.write(validateScriptRequest(request, { revision: true }), "revision");
  }
}

module.exports = { Scriptwriter };
