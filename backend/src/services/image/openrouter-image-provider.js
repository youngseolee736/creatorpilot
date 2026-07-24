const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { AppError } = require("../../middleware/error-handler");
const { openRouterHeaders } = require("../llm/openrouter");

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function firstConfigured(...values) {
  return values.map(clean).find(Boolean) || "";
}

function configurationError() {
  return new AppError(
    500,
    "IMAGE_NOT_CONFIGURED",
    "The AI image provider is not configured. Add an OpenRouter API key before generating storyboard images.",
    false,
  );
}

function safeImagePrompt(request) {
  const prompt = clean(request.imagePrompt || [
    request.visual,
    request.caption ? `On-screen caption concept: ${request.caption}` : "",
    request.narration ? `Narration context: ${request.narration}` : "",
  ].filter(Boolean).join(". "));
  if (!prompt || prompt.length > 2200) {
    throw new AppError(400, "INVALID_IMAGE_PROMPT", "The storyboard image prompt is missing or too long.", false, [
      { field: "imagePrompt", reason: "invalid_length" },
    ]);
  }
  return prompt;
}

class OpenRouterImageProvider {
  constructor(options = {}) {
    this.apiBaseUrl = firstConfigured(options.apiBaseUrl, process.env.IMAGE_API_BASE_URL, process.env.LLM_API_BASE_URL, "https://openrouter.ai/api/v1").replace(/\/$/, "");
    this.apiKey = firstConfigured(options.apiKey, process.env.IMAGE_API_KEY, process.env.LLM_API_KEY);
    this.model = firstConfigured(options.model, process.env.IMAGE_MODEL, "google/gemini-3.1-flash-lite-image");
    this.timeoutMs = Number(firstConfigured(options.timeoutMs, process.env.IMAGE_TIMEOUT_MS, process.env.LLM_TIMEOUT_MS, 300000));
    this.providerName = firstConfigured(options.providerName, process.env.IMAGE_PROVIDER, process.env.LLM_PROVIDER, "openrouter");
    this.httpReferer = String(options.httpReferer ?? process.env.OPENROUTER_HTTP_REFERER ?? "");
    this.appTitle = String(options.appTitle ?? process.env.OPENROUTER_APP_TITLE ?? "CreatorPilot");
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
  }

  endpoint() {
    return /\/images$/.test(this.apiBaseUrl) ? this.apiBaseUrl : `${this.apiBaseUrl}/images`;
  }

  validateConfiguration() {
    if (!this.apiBaseUrl || !this.apiKey || !this.model || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw configurationError();
    }
    try {
      const url = new URL(this.endpoint());
      if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error("unsafe protocol");
    } catch {
      throw configurationError();
    }
  }

  async generate(request = {}) {
    this.validateConfiguration();
    const prompt = safeImagePrompt(request);
    const controller = new this.AbortControllerImpl();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(this.endpoint(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...openRouterHeaders({
            providerName: this.providerName,
            apiBaseUrl: this.apiBaseUrl,
            httpReferer: this.httpReferer,
            appTitle: this.appTitle,
          }),
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          n: 1,
          aspect_ratio: String(request.aspectRatio || "16:9"),
          output_format: "png",
        }),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      let payload;
      try { payload = JSON.parse(rawBody); } catch { payload = null; }

      if (!response.ok) {
        throw new AppError(
          response.status === 429 ? 429 : 502,
          response.status === 429 ? "IMAGE_RATE_LIMITED" : "IMAGE_PROVIDER_ERROR",
          "The AI image provider could not generate this storyboard preview.",
          true,
        );
      }
      const image = payload?.data?.[0];
      const base64 = image?.b64_json;
      if (typeof base64 !== "string" || !base64.trim()) {
        throw new AppError(502, "INVALID_IMAGE_RESPONSE", "The AI image provider returned an unusable image response.", true);
      }
      const mediaType = clean(image.media_type || image.mime_type || "image/png");
      return {
        imageDataUrl: `data:${mediaType};base64,${base64}`,
        mediaType,
        model: this.model,
        prompt,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new AppError(504, "IMAGE_TIMEOUT", "The AI image provider timed out while generating the storyboard preview.", true);
      }
      throw new AppError(502, "IMAGE_PROVIDER_ERROR", "The AI image provider could not generate this storyboard preview.", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { OpenRouterImageProvider, safeImagePrompt };
