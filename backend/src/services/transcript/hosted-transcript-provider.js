const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { AppError } = require("../../middleware/error-handler");
const { normalizeTranscript, cleanText } = require("./normalize-transcript");

function upstreamError(status) {
  if (status === 404) return new AppError(404, "TRANSCRIPT_UNAVAILABLE", "A transcript is not available for this video.", false);
  if (status === 422) return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The hosted transcript provider rejected CreatorPilot's adapter request.", true);
  if (status === 429) return new AppError(429, "PROVIDER_RATE_LIMITED", "The transcript provider rate limit was reached. Try again later.", true);
  if (status === 408 || status === 504) return new AppError(504, "TRANSCRIPT_TIMEOUT", "The transcript provider took too long to respond.", true);
  return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider could not complete the request.", status >= 500);
}

function providerError(payload) {
  const value = payload && (payload.error || (payload.status === "error" ? payload.message || payload.detail : null));
  if (!value) return null;
  const message = cleanText(typeof value === "string" ? value : value.message);
  if (/not found|no transcript|disabled|unavailable|private/i.test(message)) {
    return new AppError(404, "TRANSCRIPT_UNAVAILABLE", "A transcript is not available for this video.", false);
  }
  return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider could not process this video.", true);
}

class HostedTranscriptProvider {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || process.env.TRANSCRIPT_API_URL || "https://youtube-transcript-api-tau-one.vercel.app/transcript";
    this.requestField = options.requestField || "url";
    this.timeoutMs = Number(options.timeoutMs || process.env.TRANSCRIPT_TIMEOUT_MS || 10000);
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
  }

  async extract(context) {
    const controller = new this.AbortControllerImpl();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    let rawBody;

    try {
      response = await this.fetchImpl(this.apiUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ [this.requestField]: context.canonicalUrl }),
        signal: controller.signal,
      });
      rawBody = await response.text();
    } catch (error) {
      if (error.name === "AbortError" || controller.signal.aborted) {
        throw new AppError(504, "TRANSCRIPT_TIMEOUT", "The transcript provider took too long to respond.", true);
      }
      throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", response
        ? "The transcript provider response could not be read."
        : "CreatorPilot could not reach the transcript provider.", true);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw upstreamError(response.status);

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider returned malformed JSON.", true);
    }
    const error = providerError(payload);
    if (error) throw error;
    return normalizeTranscript(payload, context);
  }
}

module.exports = { HostedTranscriptProvider, upstreamError };
