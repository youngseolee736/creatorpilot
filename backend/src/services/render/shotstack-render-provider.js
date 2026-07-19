const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { mapRenderError, renderConfigurationError } = require("./render-errors");

const STATUS_MAP = {
  queued: { status: "queued", stage: "Preparing production", progress: 2 },
  fetching: { status: "running", stage: "Fetching assets", progress: 20 },
  preprocessing: { status: "running", stage: "Preparing assets", progress: 40 },
  rendering: { status: "running", stage: "Rendering final video", progress: 72 },
  saving: { status: "running", stage: "Saving final video", progress: 94 },
};

function malformed() {
  const error = new Error("Shotstack returned an invalid response.");
  error.code = "INVALID_RENDER_RESPONSE";
  return error;
}

function outputSize(format) {
  if (format === "1:1") return { width: 1080, height: 1080 };
  if (format === "16:9") return { width: 1280, height: 720 };
  return { width: 720, height: 1280 };
}

function toShotstackEdit(productionPackage) {
  const scenes = productionPackage.storyboard.scenes;
  return {
    timeline: {
      background: "#111713",
      tracks: [{
        clips: scenes.map((scene) => ({
          asset: {
            type: "title",
            text: `${String(scene.number).padStart(2, "0")}  ${scene.caption}`,
            style: "minimal",
          },
          start: scene.start,
          length: scene.duration,
          transition: { in: "fade", out: "fade" },
        })),
      }],
    },
    output: {
      format: "mp4",
      size: outputSize(productionPackage.format),
      fps: 25,
      quality: "medium",
      destinations: [{ provider: "shotstack" }],
    },
  };
}

class ShotstackRenderProvider {
  constructor(options = {}) {
    this.apiUrl = String(options.apiUrl ?? process.env.SHOTSTACK_API_URL ?? "").replace(/\/$/, "");
    this.apiKey = String(options.apiKey ?? process.env.SHOTSTACK_API_KEY ?? "");
    this.timeoutMs = Number(options.timeoutMs ?? process.env.SHOTSTACK_TIMEOUT_MS ?? 30000);
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
  }

  validateConfiguration() {
    if (!this.apiUrl || !this.apiKey || !Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw renderConfigurationError();
    }
    try {
      const url = new URL(this.apiUrl);
      const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      if (url.protocol !== "https:" && !local) throw new Error("unsafe protocol");
      if (!local && url.hostname !== "api.shotstack.io") throw new Error("unexpected host");
      if (!/\/render$/u.test(url.pathname)) throw new Error("missing render endpoint");
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
        const providerError = new Error("Shotstack request failed.");
        providerError.status = response.status;
        throw providerError;
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw malformed();
      return payload;
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error("Shotstack request aborted after timeout");
        timeoutError.name = "AbortError";
        throw mapRenderError(timeoutError);
      }
      throw mapRenderError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async startRender(productionPackage) {
    const payload = await this.request(this.apiUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify(toShotstackEdit(productionPackage)),
    });
    if (payload.success !== true || typeof payload.response?.id !== "string") throw mapRenderError(malformed());
    return { jobId: payload.response.id, ...STATUS_MAP.queued };
  }

  async getStatus(providerJobId) {
    const payload = await this.request(`${this.apiUrl}/${encodeURIComponent(providerJobId)}?data=false`, {
      headers: { Accept: "application/json", "x-api-key": this.apiKey },
    });
    if (payload.success !== true || !payload.response || typeof payload.response.status !== "string") {
      throw mapRenderError(malformed());
    }
    const response = payload.response;
    const status = response.status.toLowerCase();
    if (STATUS_MAP[status]) return STATUS_MAP[status];
    if (status === "done") {
      return { status: "completed", completedAt: response.updated, videoUrl: response.url };
    }
    if (status === "failed") return { status: "failed" };
    throw mapRenderError(malformed());
  }
}

module.exports = { ShotstackRenderProvider, toShotstackEdit };
