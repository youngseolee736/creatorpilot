const { AppError } = require("../../middleware/error-handler");
const { OpenAICompatibleProvider } = require("./openai-compatible-provider");

function createLLMProvider(options = {}) {
  const providerName = String(options.providerName || process.env.LLM_PROVIDER || "openai-compatible").toLowerCase();
  if (options.provider) return options.provider;
  if (providerName === "openai-compatible") return new OpenAICompatibleProvider(options.openAICompatibleOptions);
  return {
    async complete() {
      throw new AppError(500, "ANALYSIS_INTERNAL_ERROR", "The configured Script Analyst provider is not supported.", false);
    },
  };
}

module.exports = { createLLMProvider, OpenAICompatibleProvider };
