const express = require("express");
const { createCorsMiddleware } = require("./middleware/cors");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
const { createAnalysisRouter } = require("./routes/analysis");
const { createScriptsRouter } = require("./routes/scripts");
const { createTranscriptRouter } = require("./routes/transcripts");
const { ScriptAnalyst } = require("./agents/script-analyst/script-analyst");
const { Scriptwriter } = require("./agents/scriptwriter/scriptwriter");
const { TranscriptService } = require("./services/transcript-service");
const { createRequestId } = require("./utils/request-id");

function createApp(options = {}) {
  const app = express();
  const transcriptService = options.transcriptService || new TranscriptService();
  const scriptAnalyst = options.scriptAnalyst || new ScriptAnalyst();
  const scriptwriter = options.scriptwriter || new Scriptwriter();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    req.requestId = createRequestId();
    res.set("X-Request-Id", req.requestId);
    next();
  });
  app.use(createCorsMiddleware(options.frontendOrigin || process.env.FRONTEND_ORIGIN));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "creatorpilot-backend" });
  });
  app.use("/api/transcripts", createTranscriptRouter(transcriptService));
  app.use("/api/analysis", createAnalysisRouter(scriptAnalyst));
  app.use("/api/scripts", createScriptsRouter(scriptwriter));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
