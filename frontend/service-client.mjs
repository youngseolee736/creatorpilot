import * as mockServices from "./mock-services.mjs";

const DEFAULT_CONFIG = Object.freeze({
  useMockServices: true,
  apiBaseUrl: "",
  renderPollIntervalMs: 1500,
});

const SERVICE_KEYS = ["transcript", "analysis", "script", "review", "storyboard", "video"];

export function getServiceConfig(runtimeConfig = globalThis.CREATORPILOT_CONFIG) {
  const config = { ...DEFAULT_CONFIG, ...(runtimeConfig || {}) };
  const legacyMode = config.useMockServices === false ? "api" : "mock";
  const requestedServices = config.services && typeof config.services === "object" ? config.services : {};
  const services = Object.fromEntries(SERVICE_KEYS.map((key) => [
    key,
    requestedServices[key] === "api" || requestedServices[key] === "mock" ? requestedServices[key] : legacyMode,
  ]));
  return {
    useMockServices: SERVICE_KEYS.every((key) => services[key] === "mock"),
    services,
    apiBaseUrl: String(config.apiBaseUrl || "").replace(/\/$/, ""),
    renderPollIntervalMs: Math.max(250, Number(config.renderPollIntervalMs) || 1500),
  };
}

function scriptPayload(project) {
  return {
    title: project.generatedScript?.title || project.title,
    version: project.generatedScript?.version || 1,
    estimatedSeconds: project.generatedScript?.estimatedSeconds || project.duration,
    sections: project.generatedScript?.sections || [],
  };
}

function makeApiServices(config, fetchImpl) {
  if (typeof fetchImpl !== "function") throw new Error("API mode requires the Fetch API.");

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${config.apiBaseUrl}${path}`, {
        ...options,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
      });
    } catch (cause) {
      const error = new Error("CreatorPilot could not reach the API. Your local project is still saved.");
      error.code = "NETWORK_ERROR";
      error.retryable = true;
      error.cause = cause;
      throw error;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error?.message || `The API request failed with status ${response.status}.`);
      error.code = body.error?.code || "API_ERROR";
      error.status = response.status;
      error.retryable = body.error?.retryable ?? response.status >= 500;
      error.details = body.error?.details || null;
      throw error;
    }
    return body.data ?? body;
  }

  const post = (path, payload) => request(path, { method: "POST", body: JSON.stringify(payload) });
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    extractTranscript(project) {
      return post("/api/transcripts/extract", {
        projectId: project.id,
        youtubeUrl: project.referenceUrl,
        targetLanguage: project.language,
      });
    },
    analyzeReference(project) {
      return post("/api/analysis/reference", {
        projectId: project.id,
        transcript: project.transcript,
        targetDurationSeconds: project.duration,
      });
    },
    generateScript(project) {
      return post("/api/scripts/generate", {
        projectId: project.id,
        topic: project.topic,
        targetLanguage: project.language,
        targetDurationSeconds: project.duration,
        audience: project.analysis?.targetAudience || "General YouTube audience",
        referenceAnalysis: project.analysis,
        revisionInstructions: project.originalityReview?.instructions || [],
      });
    },
    reviewOriginality(project) {
      return post("/api/scripts/review", {
        projectId: project.id,
        referenceAnalysis: project.analysis,
        referenceTranscript: project.transcript,
        script: scriptPayload(project),
      });
    },
    reviseScript(project, revisionInstructions) {
      return post("/api/scripts/revise", {
        projectId: project.id,
        topic: project.topic,
        targetLanguage: project.language,
        targetDurationSeconds: project.duration,
        audience: project.analysis?.targetAudience || "General YouTube audience",
        referenceAnalysis: project.analysis,
        currentScript: scriptPayload(project),
        revisionInstructions,
      });
    },
    generateStoryboard(project) {
      return post("/api/storyboards/generate", {
        projectId: project.id,
        approvedReviewId: project.originalityReview?.reviewId,
        script: scriptPayload(project),
        format: project.format,
      });
    },
    async renderVideo(project, onProgress = () => {}) {
      const started = await post("/api/videos/render", {
        projectId: project.id,
        approvedReviewId: project.originalityReview?.reviewId,
        storyboard: project.storyboard,
        productionSettings: project.productionSettings,
        format: project.format,
        durationSeconds: project.duration,
      });
      onProgress(started);
      if (started.completed) return started;
      if (!started.renderId) throw new Error("The render API did not return a renderId.");

      while (true) {
        await wait(config.renderPollIntervalMs);
        const status = await request(`/api/videos/${encodeURIComponent(started.renderId)}/status`);
        onProgress(status);
        if (status.status === "failed") {
          const error = new Error(status.error?.message || "Video rendering failed.");
          error.code = status.error?.code || "RENDER_FAILED";
          error.retryable = status.error?.retryable ?? true;
          throw error;
        }
        if (status.completed || status.status === "completed") return status;
      }
    },
  };
}

export function createServices(runtimeConfig, fetchImpl = globalThis.fetch?.bind(globalThis)) {
  const config = getServiceConfig(runtimeConfig);
  const needsApi = SERVICE_KEYS.some((key) => config.services[key] === "api");
  const apiServices = needsApi ? makeApiServices(config, fetchImpl) : null;
  const select = (key, mockService, apiService) => config.services[key] === "api" ? apiService : mockService;
  return {
    extractTranscript: select("transcript", mockServices.extractTranscript, apiServices?.extractTranscript),
    analyzeReference: select("analysis", mockServices.analyzeReference, apiServices?.analyzeReference),
    generateScript: select("script", mockServices.generateScript, apiServices?.generateScript),
    reviseScript: select("script", (project) => mockServices.generateScript(project), apiServices?.reviseScript),
    reviewOriginality: select("review", mockServices.reviewOriginality, apiServices?.reviewOriginality),
    generateStoryboard: select("storyboard", mockServices.generateStoryboard, apiServices?.generateStoryboard),
    renderVideo: select("video", mockServices.renderVideo, apiServices?.renderVideo),
  };
}

export const serviceConfig = getServiceConfig();
const services = createServices(serviceConfig);

export const extractTranscript = services.extractTranscript;
export const analyzeReference = services.analyzeReference;
export const generateScript = services.generateScript;
export const reviewOriginality = services.reviewOriginality;
export const reviseScript = services.reviseScript;
export const generateStoryboard = services.generateStoryboard;
export const renderVideo = services.renderVideo;
