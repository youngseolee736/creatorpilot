const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { llmConfigurationError, mapLLMError } = require("../llm/llm-errors");
const { isOpenRouter, openRouterHeaders } = require("../llm/openrouter");

function validHttpsSource(source) {
  try {
    const normalized = source?.url_citation || source;
    const url = new URL(normalized?.url);
    if (url.protocol !== "https:") return null;
    return { url: url.href, title: String(normalized?.title || url.hostname).trim().slice(0, 300) };
  } catch {
    return null;
  }
}

function responseParts(payload) {
  const texts = [];
  const sources = [];
  let refusal = "";
  for (const item of payload?.output || []) {
    if (item?.type === "web_search_call" || item?.type === "openrouter:web_search") {
      for (const source of item.action?.sources || []) {
        const valid = validHttpsSource(source);
        if (valid) sources.push(valid);
      }
    }
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "refusal") refusal = String(content.refusal || "");
      if (content?.type !== "output_text") continue;
      if (typeof content.text === "string") texts.push(content.text);
      for (const annotation of content.annotations || []) {
        if (annotation?.type !== "url_citation") continue;
        const valid = validHttpsSource(annotation);
        if (valid) sources.push(valid);
      }
    }
  }
  const unique = [...new Map(sources.map((source) => [source.url, source])).values()];
  const structuredText = [...texts].reverse().find((text) => {
    try {
      const value = JSON.parse(String(text).trim());
      return value && typeof value === "object" && !Array.isArray(value);
    } catch {
      return false;
    }
  });
  return { text: String(structuredText || texts[texts.length - 1] || "").trim(), sources: unique, refusal };
}

class OpenAIWebResearchProvider {
  constructor(options = {}) {
    this.apiBaseUrl = String(options.apiBaseUrl || "").replace(/\/$/, "");
    this.apiKey = String(options.apiKey || "");
    this.model = String(options.model || "");
    this.timeoutMs = Number(options.timeoutMs || 30000);
    this.providerName = String(options.providerName || "openai-web-search");
    this.httpReferer = String(options.httpReferer || "");
    this.appTitle = String(options.appTitle || "");
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
  }

  endpoint() {
    return /\/responses$/.test(this.apiBaseUrl) ? this.apiBaseUrl : `${this.apiBaseUrl}/responses`;
  }

  usesOpenRouter() {
    return isOpenRouter(this.providerName, this.apiBaseUrl);
  }

  requestBody({ instructions, input, schema }) {
    const openRouter = this.usesOpenRouter();
    return {
      model: this.model,
      instructions,
      input,
      tools: openRouter
        ? [{
          type: "openrouter:web_search",
          parameters: {
            engine: "exa",
            search_context_size: "medium",
            max_results: 5,
            max_total_results: 10,
          },
        }]
        : [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "required",
      ...(!openRouter ? { include: ["web_search_call.action.sources"] } : { max_tool_calls: 3 }),
      text: { format: { type: "json_schema", name: "creatorpilot_fact_pack", strict: true, schema } },
      store: false,
    };
  }

  validateConfiguration() {
    if (!this.apiBaseUrl || !this.apiKey || !this.model || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw llmConfigurationError("Research Agent");
    }
    try {
      const url = new URL(this.endpoint());
      if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error("unsafe protocol");
    } catch {
      throw llmConfigurationError("Research Agent");
    }
  }

  async research({ instructions, input, schema }) {
    this.validateConfiguration();
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
        body: JSON.stringify(this.requestBody({ instructions, input, schema })),
        signal: controller.signal,
      });
      const rawBody = await response.text();
      let payload;
      try { payload = JSON.parse(rawBody); } catch { payload = null; }
      if (!response.ok) {
        const error = new Error("Research provider request failed.");
        error.status = response.status;
        throw error;
      }
      const result = responseParts(payload);
      if (result.refusal) {
        const error = new Error("Research provider refused the request.");
        error.status = 422;
        throw error;
      }
      if (!result.text || !result.sources.length) throw new Error("Research provider returned no grounded result.");
      return result;
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error("Research request aborted after timeout");
        timeoutError.name = "AbortError";
        throw mapLLMError(timeoutError, "Research Agent");
      }
      throw mapLLMError(error, "Research Agent");
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { OpenAIWebResearchProvider, responseParts };
