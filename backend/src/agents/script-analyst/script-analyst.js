const { createLLMProvider } = require("../../services/llm");
const { mapLLMError } = require("../../services/llm/llm-errors");
const { normalizeAnalysis, parseAnalysisJSON } = require("./normalize-analysis");
const {
  JSON_REPAIR_SYSTEM_PROMPT,
  SCRIPT_ANALYST_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  buildRepairUserPrompt,
} = require("./script-analyst-prompt");
const { validateAnalysisRequest } = require("./script-analyst-schema");

class ScriptAnalyst {
  constructor(options = {}) {
    this.provider = options.provider || createLLMProvider({
      ...(options.llmOptions || {}),
      envPrefix: "ANALYST",
      agentLabel: "Script Analyst",
      unsupportedErrorCode: "ANALYSIS_INTERNAL_ERROR",
    });
  }

  async providerComplete(messages) {
    try {
      return await this.provider.complete(messages);
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
}

module.exports = { ScriptAnalyst };
