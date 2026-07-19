const { AppError } = require("../../middleware/error-handler");
const { hasLLMConfiguration, resolveLLMConfig } = require("./llm-config");
const { OpenAICompatibleProvider } = require("./openai-compatible-provider");

function createLLMProvider(options = {}) {
  const resolved = resolveLLMConfig(options.envPrefix, options.environment || process.env);
  const providerName = String(options.providerName || resolved.providerName).toLowerCase();
  if (options.provider) return options.provider;
  if (providerName === "openai-compatible") return new OpenAICompatibleProvider({
    apiBaseUrl: resolved.apiBaseUrl || "",
    apiKey: resolved.apiKey || "",
    model: resolved.model || "",
    timeoutMs: resolved.timeoutMs,
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

module.exports = { createLLMProvider, hasLLMConfiguration, OpenAICompatibleProvider, resolveLLMConfig };
