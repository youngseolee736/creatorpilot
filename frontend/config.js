// Public runtime configuration only. Never place API keys or secrets in this file.
// Deployment environments may replace this object without rebuilding the frontend.
window.CREATORPILOT_CONFIG = Object.freeze({
  useMockServices: false,
  services: {
    transcript: "api",
    analysis: "api",
    research: "api",
    script: "api",
    storyboard: "api",
    image: "api",
  },
  // Local dev serves the frontend from port 4173 and calls the backend on 8787.
  // Vercel serves the frontend and API from the same origin.
  apiBaseUrl: window.location.port === "4173" ? "http://127.0.0.1:8787" : "",
});
