const { AppError } = require("../../middleware/error-handler");
const { OpenAICompatibleProvider } = require("./openai-compatible-provider");

function createLLMProvider(options = {}) {
  const providerName = String(options.providerName || process.env.LLM_PROVIDER || "openai-compatible").toLowerCase();
  if (options.provider) return options.provider;
  if (providerName === "openai-compatible") return new OpenAICompatibleProvider({
    ...(options.openAICompatibleOptions || {}),
    agentLabel: options.agentLabel,
  });
  return {
    async complete() {
      const label = options.agentLabel || "Script Analyst";
      throw new AppError(
        500,
        options.unsupportedErrorCode || "ANALYSIS_INTERNAL_ERROR",
        `The configured ${label} provider is not supported.`,
        false,
      );
    },
  };
}

module.exports = { createLLMProvider, OpenAICompatibleProvider };
