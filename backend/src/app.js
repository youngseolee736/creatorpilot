const express = require("express");
const path = require("path");
const { createCorsMiddleware } = require("./middleware/cors");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
const { createAnalysisRouter } = require("./routes/analysis");
const { createResearchRouter } = require("./routes/research");
const { createScriptsRouter } = require("./routes/scripts");
const { createStoryboardRouter } = require("./routes/storyboards");
const { createImagesRouter } = require("./routes/images");
const { createTranscriptRouter } = require("./routes/transcripts");
const { ScriptAnalyst } = require("./agents/script-analyst/script-analyst");
const { Researcher } = require("./agents/researcher/researcher");
const { Scriptwriter } = require("./agents/scriptwriter/scriptwriter");
const { StoryboardAgent } = require("./agents/storyboard/storyboard");
const { OpenRouterImageProvider } = require("./services/image-provider");
const { TranscriptService } = require("./services/transcript");
const { createRequestId } = require("./utils/request-id");

function createApp(options = {}) {
  const app = express();
  const transcriptService = options.transcriptService || new TranscriptService();
  const scriptAnalyst = options.scriptAnalyst || new ScriptAnalyst();
  const researcher = options.researcher || new Researcher();
  const scriptwriter = options.scriptwriter || new Scriptwriter();
  const storyboardAgent = options.storyboardAgent || new StoryboardAgent();
  const imageProvider = options.imageProvider || new OpenRouterImageProvider();

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
  app.use("/api/research", createResearchRouter(researcher));
  app.use("/api/scripts", createScriptsRouter(scriptwriter));
  app.use("/api/storyboards", createStoryboardRouter(storyboardAgent));
  app.use("/api/images", createImagesRouter(imageProvider));
  app.use(express.static(path.join(__dirname, "..", "..", "frontend")));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
