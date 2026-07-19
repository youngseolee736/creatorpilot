const CONFIG_FIELDS = {
  providerName: "LLM_PROVIDER",
  apiBaseUrl: "LLM_API_BASE_URL",
  apiKey: "LLM_API_KEY",
  model: "LLM_MODEL",
  timeoutMs: "LLM_TIMEOUT_MS",
};

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveLLMConfig(envPrefix, environment = process.env) {
  const prefix = nonEmpty(envPrefix)?.toUpperCase();
  const resolved = {};
  for (const [property, globalName] of Object.entries(CONFIG_FIELDS)) {
    const scopedName = prefix ? `${prefix}_${globalName}` : null;
    resolved[property] = (scopedName && nonEmpty(environment[scopedName])) || nonEmpty(environment[globalName]);
  }
  return {
    ...resolved,
    providerName: resolved.providerName || "openai-compatible",
    timeoutMs: resolved.timeoutMs === undefined ? 30000 : Number(resolved.timeoutMs),
  };
}

function hasLLMConfiguration(envPrefix, environment = process.env) {
  const config = resolveLLMConfig(envPrefix, environment);
  return Boolean(config.apiBaseUrl && config.apiKey && config.model);
}

module.exports = { hasLLMConfiguration, resolveLLMConfig };
