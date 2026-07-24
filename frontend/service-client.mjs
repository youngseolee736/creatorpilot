import * as mockServices from "./mock-services.mjs";

const DEFAULT_CONFIG = Object.freeze({
  useMockServices: true,
  apiBaseUrl: "",
});

const SERVICE_KEYS = ["transcript", "analysis", "research", "script", "storyboard", "image"];

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
  };
}

function scriptPayload(project) {
  return {
    scriptId: project.generatedScript?.scriptId,
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
  return {
    extractTranscript(project, reference = project.references?.[0]) {
      return post("/api/transcripts/extract", {
        projectId: reference?.position > 1 ? `${project.id}_${reference.referenceId}` : project.id,
        youtubeUrl: reference?.url || project.referenceUrl,
        targetLanguage: project.language,
      });
    },
    analyzeReference(project, reference = project.references?.[0]) {
      return post("/api/analysis/reference", {
        projectId: reference?.position > 1 ? `${project.id}_${reference.referenceId}` : project.id,
        targetTopic: project.topic,
        transcript: reference?.transcript || project.transcript,
        targetDurationSeconds: project.duration,
        analysisLanguage: project.language,
      });
    },
    synthesizeReferences(project) {
      return post("/api/analysis/synthesize", {
        projectId: project.id,
        targetTopic: project.topic,
        targetDurationSeconds: project.duration,
        analysisLanguage: project.language,
        analysisMode: project.analysisDepth === "deep" ? "deep" : "standard",
        analyses: (project.references || []).map((reference) => ({
          referenceId: reference.referenceId,
          title: reference.title,
          analysis: reference.analysis,
        })),
      });
    },
    researchTopic(project) {
      return post("/api/research/topic", {
        projectId: project.id,
        analysisMode: project.analysisDepth === "deep" ? "deep" : "standard",
        creativeBrief: project.creativeBrief,
        referenceBlueprint: project.referenceBlueprint,
      });
    },
    generateScript(project) {
      return post("/api/scripts/generate", {
        projectId: project.id,
        analysisMode: project.analysisDepth === "deep" ? "deep" : "standard",
        creativeBrief: project.creativeBrief,
        referenceBlueprint: project.referenceBlueprint,
        factPack: project.research,
        targetLanguage: project.language,
        targetDurationSeconds: project.duration,
        revisionInstructions: [],
      });
    },
    reviseScript(project, revisionInstructions) {
      return post("/api/scripts/revise", {
        projectId: project.id,
        analysisMode: project.analysisDepth === "deep" ? "deep" : "standard",
        creativeBrief: project.creativeBrief,
        referenceBlueprint: project.referenceBlueprint,
        factPack: project.research,
        targetLanguage: project.language,
        targetDurationSeconds: project.duration,
        currentScript: scriptPayload(project),
        revisionInstructions,
        preserveSectionIds: true,
      });
    },
    generateStoryboard(project) {
      return post("/api/storyboards/generate", {
        projectId: project.id,
        script: scriptPayload(project),
        format: project.format,
        targetDurationSeconds: project.duration,
        sceneCount: 8,
        visualConstraints: ["Use licensed, original, or generated assets only."],
      });
    },
    generateStoryboardImage(project, scene) {
      return post("/api/images/generate", {
        projectId: project.id,
        sceneId: scene.id,
        number: scene.number,
        format: project.format,
        title: project.title,
        narration: scene.narration,
        caption: scene.caption,
        visual: scene.visual,
        imagePrompt: scene.imagePrompt,
        aspectRatio: "16:9",
      });
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
    synthesizeReferences: select("analysis", mockServices.synthesizeReferences, apiServices?.synthesizeReferences),
    researchTopic: select("research", mockServices.researchTopic, apiServices?.researchTopic),
    generateScript: select("script", mockServices.generateScript, apiServices?.generateScript),
    reviseScript: select("script", mockServices.reviseScript, apiServices?.reviseScript),
    generateStoryboard: select("storyboard", mockServices.generateStoryboard, apiServices?.generateStoryboard),
    generateStoryboardImage: select("image", mockServices.generateStoryboardImage, apiServices?.generateStoryboardImage),
  };
}

export const serviceConfig = getServiceConfig();
const services = createServices(serviceConfig);

export const extractTranscript = services.extractTranscript;
export const analyzeReference = services.analyzeReference;
export const synthesizeReferences = services.synthesizeReferences;
export const researchTopic = services.researchTopic;
export const generateScript = services.generateScript;
export const reviseScript = services.reviseScript;
export const generateStoryboard = services.generateStoryboard;
export const generateStoryboardImage = services.generateStoryboardImage;
