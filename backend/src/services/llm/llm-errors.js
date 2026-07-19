const { AppError } = require("../../middleware/error-handler");

function llmConfigurationError(agentLabel = "AI agent") {
  return new AppError(
    500,
    "LLM_NOT_CONFIGURED",
    `The ${agentLabel} is not configured. Add the server-side LLM provider settings and try again.`,
    false,
  );
}

function mapLLMError(error, agentLabel = "Script Analyst") {
  if (error instanceof AppError) return error;

  const name = String(error && (error.name || error.constructor?.name) || "");
  const message = String(error && error.message || "");
  const status = Number(error && (error.status || error.statusCode));
  const signature = `${name} ${message}`;

  if (/AbortError|aborted|timeout/i.test(signature) || status === 408 || status === 504) {
    return new AppError(504, "LLM_TIMEOUT", `The ${agentLabel} took too long to respond.`, true);
  }
  if (status === 429 || /rate.?limit|too many requests/i.test(signature)) {
    return new AppError(429, "LLM_RATE_LIMITED", `The ${agentLabel} rate limit was reached. Try again later.`, true);
  }
  if (status === 401 || status === 403 || /authentication|unauthorized|forbidden|api key/i.test(signature)) {
    return new AppError(502, "LLM_PROVIDER_ERROR", `The ${agentLabel} provider rejected the server configuration.`, false);
  }
  return new AppError(502, "LLM_PROVIDER_ERROR", `The ${agentLabel} provider could not complete the request.`, true);
}

module.exports = { llmConfigurationError, mapLLMError };
