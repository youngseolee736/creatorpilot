const { resolveLLMConfig } = require("../../services/llm");
const { OpenAIWebResearchProvider } = require("../../services/research/openai-web-research-provider");
const { normalizeResearch, parseResearchJSON } = require("./normalize-research");
const { RESEARCH_OUTPUT_SCHEMA, RESEARCHER_SYSTEM_PROMPT, buildResearchPrompt } = require("./researcher-prompt");
const { validateResearchRequest } = require("./researcher-schema");

class Researcher {
  constructor(options = {}) {
    const config = resolveLLMConfig("RESEARCH", options.environment || process.env);
    const hasScopedTimeout = Boolean((options.environment || process.env).RESEARCH_LLM_TIMEOUT_MS);
    this.provider = options.provider || new OpenAIWebResearchProvider({
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: hasScopedTimeout ? config.timeoutMs : Math.max(Number(config.timeoutMs) || 0, 300000),
      ...(options.providerOptions || {}),
    });
    this.completed = new Map();
    this.maxCompleted = Number(options.maxCompleted) || 100;
  }

  async research(request) {
    const input = validateResearchRequest(request);
    const key = JSON.stringify(input);
    if (this.completed.has(key)) return this.completed.get(key);
    const response = await this.provider.research({
      instructions: RESEARCHER_SYSTEM_PROMPT,
      input: buildResearchPrompt(input),
      schema: RESEARCH_OUTPUT_SCHEMA,
    });
    const result = normalizeResearch(parseResearchJSON(response.text), response.sources, input);
    if (this.completed.size >= this.maxCompleted) this.completed.delete(this.completed.keys().next().value);
    this.completed.set(key, result);
    return result;
  }
}

module.exports = { Researcher };
