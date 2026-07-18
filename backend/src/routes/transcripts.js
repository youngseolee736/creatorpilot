const express = require("express");
const { AppError } = require("../middleware/error-handler");
const { extractYouTubeVideo } = require("../utils/youtube-url");

function createTranscriptRouter(transcriptService) {
  const router = express.Router();

  router.post("/extract", async (req, res, next) => {
    try {
      const { projectId, youtubeUrl, targetLanguage, preferredCaptionLanguage } = req.body || {};
      const video = extractYouTubeVideo(youtubeUrl);
      if (!video) {
        throw new AppError(400, "INVALID_YOUTUBE_URL", "Enter a valid public YouTube video URL.", false, [
          { field: "youtubeUrl", reason: youtubeUrl ? "invalid_url" : "required" },
        ]);
      }
      if (typeof projectId !== "string" || !projectId.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "projectId is required.", false, [{ field: "projectId", reason: "required" }]);
      }
      if (typeof targetLanguage !== "string" || !targetLanguage.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "targetLanguage is required.", false, [{ field: "targetLanguage", reason: "required" }]);
      }

      const data = await transcriptService.extract({
        projectId: projectId.trim(),
        targetLanguage: targetLanguage.trim(),
        preferredCaptionLanguage,
        ...video,
      });
      res.status(200).json({ requestId: req.requestId, data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createTranscriptRouter };
