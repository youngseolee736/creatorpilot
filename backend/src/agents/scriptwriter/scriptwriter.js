const { createLLMProvider, resolveLLMConfig } = require("../../services/llm");
const { mapLLMError } = require("../../services/llm/llm-errors");
const {
  createSectionPlan,
  normalizeScript,
  parseScriptJSON,
  requestFingerprint,
} = require("./normalize-script");
const {
  SCRIPT_REPAIR_SYSTEM_PROMPT,
  SCRIPTWRITER_SYSTEM_PROMPT,
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
    this.completed = new Map();
    this.inFlight = new Map();
    this.maxCompleted = Number(options.maxCompleted) || 100;
  }

  async providerComplete(messages) {
    try {
      return await this.provider.complete(messages);
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

    const operation = this.generateCandidate(input, mode, fingerprint)
      .then((result) => {
        this.remember(fingerprint, result);
        return result;
      })
      .finally(() => this.inFlight.delete(fingerprint));
    this.inFlight.set(fingerprint, operation);
    return operation;
  }

  async generateCandidate(input, mode, fingerprint) {
    const sectionPlan = createSectionPlan(input);
    const options = { revision: mode === "revision" };
    let raw = await this.providerComplete([
      { role: "system", content: SCRIPTWRITER_SYSTEM_PROMPT },
      { role: "user", content: buildScriptUserPrompt(input, sectionPlan, options) },
    ]);
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
      ]);
    }
    throw validationError;
  }

  generate(request) {
    return this.write(validateScriptRequest(request), "generation");
  }

  revise(request) {
    return this.write(validateScriptRequest(request, { revision: true }), "revision");
  }
}

module.exports = { Scriptwriter };
