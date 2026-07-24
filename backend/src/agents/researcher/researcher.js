const { createLLMProvider, resolveLLMConfig } = require("../../services/llm");
const { normalizeResearch, parseResearchJSON } = require("./normalize-research");
const {
  RESEARCH_OUTPUT_SCHEMA,
  RESEARCHER_SYSTEM_PROMPT,
  buildResearchPrompt,
} = require("./researcher-prompt");
const { validateResearchRequest } = require("./researcher-schema");

class Researcher {
  constructor(options = {}) {
    const environment = options.environment || process.env;
    const createResearchProvider = (prefix) => {
      const config = resolveLLMConfig(prefix, environment);
      const hasScopedTimeout = Boolean(environment[`${prefix}_LLM_TIMEOUT_MS`]);
      return createLLMProvider({
        envPrefix: prefix,
        environment,
        openAICompatibleOptions: {
          timeoutMs: hasScopedTimeout ? config.timeoutMs : Math.max(Number(config.timeoutMs) || 0, 300000),
          ...(options.providerOptions || {}),
        },
        agentLabel: "Research Agent",
      });
    };
    this.provider = options.provider || createResearchProvider("RESEARCH");
    this.completed = new Map();
    this.maxCompleted = Number(options.maxCompleted) || 100;
  }

  async research(request) {
    const input = validateResearchRequest(request);
    const key = JSON.stringify(input);
    if (this.completed.has(key)) return this.completed.get(key);
    const run = async (provider, instructions, prompt) => {
      if (typeof provider.research === "function") {
        const response = await provider.research({ instructions, input: prompt, schema: RESEARCH_OUTPUT_SCHEMA });
        return normalizeResearch(parseResearchJSON(response.text), response.sources, input);
      }
      const response = await provider.complete([
        { role: "system", content: instructions },
        { role: "user", content: prompt },
      ], { temperature: 0.2 });
      return normalizeResearch(parseResearchJSON(response), [], input);
    };
    const result = await run(this.provider, RESEARCHER_SYSTEM_PROMPT, buildResearchPrompt(input));
    if (this.completed.size >= this.maxCompleted) this.completed.delete(this.completed.keys().next().value);
    this.completed.set(key, result);
    return result;
  }
}

module.exports = { Researcher };
