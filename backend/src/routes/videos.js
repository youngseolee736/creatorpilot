const express = require("express");
const { AppError } = require("../middleware/error-handler");

function createVideosRouter(videoProducer) {
  const router = express.Router();

  router.post("/render", async (req, res, next) => {
    try {
      const data = await videoProducer.start(req.body);
      res.status(202).json({ requestId: req.requestId, data });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "VIDEO_PRODUCER_INTERNAL_ERROR", "CreatorPilot could not start the render.", true));
    }
  });

  router.get("/:renderId/status", async (req, res, next) => {
    try {
      const data = await videoProducer.status(req.params.renderId);
      res.json({ requestId: req.requestId, data });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "VIDEO_PRODUCER_INTERNAL_ERROR", "CreatorPilot could not read render status.", true));
    }
  });

  return router;
}

module.exports = { createVideosRouter };
