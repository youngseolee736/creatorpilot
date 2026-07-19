const express = require("express");
const { AppError } = require("../middleware/error-handler");

function createStoryboardRouter(storyboardAgent) {
  const router = express.Router();

  router.post("/generate", async (req, res, next) => {
    try {
      const storyboard = await storyboardAgent.generate(req.body);
      res.status(201).json({ requestId: req.requestId, data: storyboard.scenes });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "STORYBOARD_INTERNAL_ERROR", "CreatorPilot could not generate the storyboard.", true));
    }
  });

  return router;
}

module.exports = { createStoryboardRouter };
