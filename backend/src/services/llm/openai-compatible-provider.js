const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { LLMProvider } = require("./llm-provider");
const { llmConfigurationError, mapLLMError } = require("./llm-errors");

class OpenAICompatibleProvider extends LLMProvider {
  constructor(options = {}) {
    super();
    this.apiBaseUrl = String(options.apiBaseUrl ?? process.env.LLM_API_BASE_URL ?? "").replace(/\/$/, "");
    this.apiKey = String(options.apiKey ?? process.env.LLM_API_KEY ?? "");
    this.model = String(options.model ?? process.env.LLM_MODEL ?? "");
    this.timeoutMs = Number(options.timeoutMs ?? process.env.LLM_TIMEOUT_MS ?? 30000);
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
    this.agentLabel = options.agentLabel || "AI agent";
  }

  endpoint() {
    return /\/chat\/completions$/.test(this.apiBaseUrl)
      ? this.apiBaseUrl
      : `${this.apiBaseUrl}/chat/completions`;
  }

  validateConfiguration() {
    if (!this.apiBaseUrl || !this.apiKey || !this.model || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw llmConfigurationError(this.agentLabel);
    }
    try {
      const url = new URL(this.endpoint());
      if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error("unsafe protocol");
    } catch {
      throw llmConfigurationError(this.agentLabel);
    }
  }

  async complete(messages, options = {}) {
    this.validateConfiguration();
    const controller = new this.AbortControllerImpl();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;

    try {
      const requestBody = {
        model: this.model,
        messages,
        response_format: { type: "json_object" },
      };
      if (options.temperature !== undefined) {
        requestBody.temperature = options.temperature;
      }

      response = await this.fetchImpl(this.endpoint(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      let payload;
      try { payload = JSON.parse(rawBody); } catch { payload = null; }

      if (!response.ok) {
        const providerError = new Error("LLM provider request failed.");
        providerError.status = response.status;
        throw providerError;
      }
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("LLM provider returned an empty response.");
      }
      return content;
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error("LLM request aborted after timeout");
        timeoutError.name = "AbortError";
        throw mapLLMError(timeoutError, this.agentLabel);
      }
      throw mapLLMError(error, this.agentLabel);
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { OpenAICompatibleProvider };
