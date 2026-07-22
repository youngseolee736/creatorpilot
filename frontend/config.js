// Public runtime configuration only. Never place API keys or secrets in this file.
// Deployment environments may replace this object without rebuilding the frontend.
window.CREATORPILOT_CONFIG = Object.freeze({
  useMockServices: false,
  services: {
    transcript: "api",
    analysis: "api",
    research: "api",
    script: "api",
    review: "api",
    storyboard: "api",
    video: "api",
  },
  // Local dev serves the frontend from port 4173 and calls the backend on 8787.
  // When the backend serves the frontend itself (e.g. Render), use same-origin.
  apiBaseUrl: window.location.port === "4173" ? "http://127.0.0.1:8787" : "",
  renderPollIntervalMs: 1500,
  renderPollLimit: 240,
});
