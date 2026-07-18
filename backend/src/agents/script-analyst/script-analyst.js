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
    this.provider = options.provider || createLLMProvider(options.llmOptions);
  }

  async providerComplete(messages) {
    try {
      return await this.provider.complete(messages, { temperature: 0.1 });
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

    let parsed;
    try {
      parsed = parseAnalysisJSON(raw);
    } catch {
      const repaired = await this.providerComplete([
        { role: "system", content: JSON_REPAIR_SYSTEM_PROMPT },
        { role: "user", content: buildRepairUserPrompt(raw) },
      ]);
      parsed = parseAnalysisJSON(repaired);
    }
    return normalizeAnalysis(parsed, input);
  }
}

module.exports = { ScriptAnalyst };
