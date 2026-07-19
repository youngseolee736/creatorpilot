const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { mapRenderError, renderConfigurationError } = require("./render-errors");

class HttpRenderProvider {
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl ?? process.env.RENDER_API_BASE_URL ?? "").replace(/\/$/, "");
    this.apiKey = String(options.apiKey ?? process.env.RENDER_API_KEY ?? "");
    this.timeoutMs = Number(options.timeoutMs ?? process.env.RENDER_TIMEOUT_MS ?? 30000);
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
  }

  endpoint() {
    return /\/renders$/u.test(this.apiBaseUrl) ? this.apiBaseUrl : `${this.apiBaseUrl}/renders`;
  }

  validateConfiguration() {
    if (!this.apiBaseUrl || !this.apiKey || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw renderConfigurationError();
    }
    try {
      const url = new URL(this.endpoint());
      if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        throw new Error("unsafe protocol");
      }
    } catch {
      throw renderConfigurationError();
    }
  }

  async request(url, options = {}) {
    this.validateConfiguration();
    const controller = new this.AbortControllerImpl();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...options, signal: controller.signal });
      const rawBody = await response.text();
      let payload;
      try { payload = JSON.parse(rawBody); } catch { payload = null; }
      if (!response.ok) {
        const providerError = new Error("Render provider request failed.");
        providerError.status = response.status;
        throw providerError;
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        const malformed = new Error("Render provider returned malformed JSON.");
        malformed.code = "INVALID_RENDER_RESPONSE";
        throw malformed;
      }
      return payload;
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error("Render request aborted after timeout");
        timeoutError.name = "AbortError";
        throw mapRenderError(timeoutError);
      }
      throw mapRenderError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  startRender(productionPackage, idempotencyKey) {
    return this.request(this.endpoint(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(productionPackage),
    });
  }

  getStatus(providerJobId) {
    return this.request(`${this.endpoint()}/${encodeURIComponent(providerJobId)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}` },
    });
  }
}

module.exports = { HttpRenderProvider };
