const { AppError } = require("../../middleware/error-handler");

function renderConfigurationError() {
  return new AppError(
    500,
    "RENDER_NOT_CONFIGURED",
    "The render provider is not configured. Add the server-side render settings and try again.",
    false,
  );
}

function mapRenderError(error) {
  if (error instanceof AppError) return error;
  if (error?.code === "INVALID_RENDER_RESPONSE") {
    return new AppError(502, "INVALID_RENDER_RESPONSE", "The render provider returned malformed JSON.", true);
  }
  const name = String(error && (error.name || error.constructor?.name) || "");
  const message = String(error?.message || "");
  const status = Number(error && (error.status || error.statusCode));
  const signature = `${name} ${message}`;
  if (/AbortError|aborted|timeout/i.test(signature) || status === 408 || status === 504) {
    return new AppError(504, "RENDER_TIMEOUT", "The render provider took too long to respond.", true);
  }
  if (status === 429 || /rate.?limit|capacity|too many requests/i.test(signature)) {
    return new AppError(429, "RENDER_CAPACITY_LIMITED", "The render provider is at capacity. Try again later.", true);
  }
  if (status === 401 || status === 403 || /authentication|unauthorized|forbidden|api key/i.test(signature)) {
    return new AppError(502, "RENDER_PROVIDER_ERROR", "The render provider rejected the server configuration.", false);
  }
  return new AppError(502, "RENDER_PROVIDER_ERROR", "The render provider could not complete the request.", true);
}

module.exports = { mapRenderError, renderConfigurationError };
