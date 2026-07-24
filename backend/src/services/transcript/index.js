const { AppError } = require("../../middleware/error-handler");
const { LocalYouTubeTranscriptProvider } = require("./local-youtube-transcript-provider");
const { HostedTranscriptProvider } = require("./hosted-transcript-provider");
const { normalizeTranscript } = require("./normalize-transcript");

function enabled(value) {
  return value === true || String(value || "").toLowerCase() === "true";
}

class TranscriptService {
  constructor(options = {}) {
    this.providerName = String(options.providerName || process.env.TRANSCRIPT_PROVIDER || "local").toLowerCase();
    this.fallbackEnabled = enabled(options.fallbackEnabled ?? process.env.TRANSCRIPT_HTTP_FALLBACK_ENABLED);
    this.localProvider = options.localProvider || new LocalYouTubeTranscriptProvider(options.localOptions);
    this.hostedProvider = options.hostedProvider || new HostedTranscriptProvider(options.hostedOptions);
  }

  async extract(context) {
    if (this.providerName === "hosted") return this.hostedProvider.extract(context);
    if (this.providerName !== "local") {
      throw new AppError(500, "INTERNAL_ERROR", "CreatorPilot transcript provider configuration is invalid.", false);
    }
    try {
      return await this.localProvider.extract(context);
    } catch (error) {
      if (this.fallbackEnabled && error && error.retryable) {
        return this.hostedProvider.extract(context);
      }
      throw error;
    }
  }
}

module.exports = { TranscriptService, normalizeProviderPayload: normalizeTranscript, enabled };
