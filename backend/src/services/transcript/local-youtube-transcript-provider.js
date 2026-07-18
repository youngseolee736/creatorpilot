const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { fetchTranscript } = require("youtube-transcript");
const { normalizeTranscript } = require("./normalize-transcript");
const { mapTranscriptError } = require("./transcript-errors");

class LocalYouTubeTranscriptProvider {
  constructor(options = {}) {
    this.fetchTranscriptImpl = options.fetchTranscriptImpl || fetchTranscript;
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = Number(options.timeoutMs || process.env.TRANSCRIPT_TIMEOUT_MS || 10000);
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
  }

  async extract(context) {
    const controller = new this.AbortControllerImpl();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const providerFetch = (url, options = {}) => this.fetchImpl(url, { ...options, signal: controller.signal });

    try {
      const config = { fetch: providerFetch };
      if (context.preferredCaptionLanguage) config.lang = context.preferredCaptionLanguage;
      const segments = await this.fetchTranscriptImpl(context.videoId, config);
      return normalizeTranscript({
        segments,
        language: Array.isArray(segments) ? segments.find((segment) => segment?.lang)?.lang : null,
        title: null,
      }, context);
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error("Transcript request aborted after timeout");
        timeoutError.name = "AbortError";
        throw mapTranscriptError(timeoutError);
      }
      throw mapTranscriptError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { LocalYouTubeTranscriptProvider };
