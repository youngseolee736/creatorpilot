// Public runtime configuration only. Never place API keys or secrets in this file.
// Deployment environments may replace this object without rebuilding the frontend.
window.CREATORPILOT_CONFIG = Object.freeze({
  useMockServices: false,
  services: {
    transcript: "api",
    analysis: "api",
    script: "api",
    review: "api",
    storyboard: "api",
    video: "api",
  },
  apiBaseUrl: "http://127.0.0.1:8787",
  renderPollIntervalMs: 1500,
  renderPollLimit: 240,
});
