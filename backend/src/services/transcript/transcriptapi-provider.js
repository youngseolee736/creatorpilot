const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { AppError } = require("../../middleware/error-handler");
const { normalizeTranscript } = require("./normalize-transcript");

const DEFAULT_API_URL = "https://transcriptapi.com/api/v2/youtube/transcript";

function transcriptApiError(status) {
  if (status === 401) {
    return new AppError(503, "TRANSCRIPT_PROVIDER_NOT_CONFIGURED", "The transcript provider API key is invalid.", false);
  }
  if (status === 402) {
    return new AppError(402, "TRANSCRIPT_CREDITS_EXHAUSTED", "The transcript provider has no credits remaining.", false);
  }
  if (status === 404) {
    return new AppError(404, "TRANSCRIPT_UNAVAILABLE", "A transcript is not available for this video.", false);
  }
  if (status === 400 || status === 422) {
    return new AppError(400, "INVALID_YOUTUBE_URL", "Enter a valid public YouTube video URL.", false);
  }
  if (status === 429) {
    return new AppError(429, "PROVIDER_RATE_LIMITED", "The transcript provider rate limit was reached. Try again later.", true);
  }
  if (status === 408 || status === 504) {
    return new AppError(504, "TRANSCRIPT_TIMEOUT", "The transcript provider took too long to respond.", true);
  }
  if (status === 503) {
    return new AppError(503, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider is temporarily unavailable.", true);
  }
  return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider could not complete the request.", status >= 500);
}

function preferredLanguage(value) {
  const normalized = String(value || "").trim().toLowerCase().replace("_", "-");
  if (!normalized) return null;
  const aliases = {
    english: "en",
    korean: "ko",
    japanese: "ja",
    spanish: "es",
    french: "fr",
    german: "de",
  };
  return aliases[normalized] || normalized;
}

class TranscriptApiProvider {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || process.env.TRANSCRIPTAPI_API_URL || DEFAULT_API_URL;
    this.apiKey = options.apiKey ?? process.env.TRANSCRIPTAPI_API_KEY ?? "";
    this.timeoutMs = Number(options.timeoutMs || process.env.TRANSCRIPT_TIMEOUT_MS || 10000);
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
    this.cache = options.cache || new Map();
  }

  async extract(context) {
    if (!String(this.apiKey).trim()) {
      throw new AppError(
        503,
        "TRANSCRIPT_PROVIDER_NOT_CONFIGURED",
        "The transcript provider is not configured.",
        false,
      );
    }

    const language = preferredLanguage(context.preferredCaptionLanguage);
    const cacheKey = `${context.videoId}:${language || "auto"}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const url = new URL(this.apiUrl);
    url.searchParams.set("video_url", context.canonicalUrl);
    url.searchParams.set("format", "json");
    url.searchParams.set("include_timestamp", "true");
    url.searchParams.set("send_metadata", "true");
    if (language) url.searchParams.set("language", language);

    const pending = this.requestTranscript(url, context);
    this.cache.set(cacheKey, pending);
    try {
      const transcript = await pending;
      this.cache.set(cacheKey, transcript);
      return transcript;
    } catch (error) {
      this.cache.delete(cacheKey);
      throw error;
    }
  }

  async requestTranscript(url, context) {
    const controller = new this.AbortControllerImpl();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    let rawBody;

    try {
      response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
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

    if (!response.ok) throw transcriptApiError(response.status);

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider returned malformed JSON.", true);
    }

    const transcript = normalizeTranscript(payload, context);
    return transcript;
  }
}

module.exports = {
  DEFAULT_API_URL,
  TranscriptApiProvider,
  preferredLanguage,
  transcriptApiError,
};
