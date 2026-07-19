const express = require("express");
const { AppError } = require("../middleware/error-handler");

function createScriptsRouter(scriptwriter, originalityReviewer) {
  const router = express.Router();

  router.post("/generate", async (req, res, next) => {
    try {
      const data = await scriptwriter.generate(req.body);
      res.status(201).json({ requestId: req.requestId, data });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "SCRIPT_INTERNAL_ERROR", "CreatorPilot could not generate the script.", true));
    }
  });

  router.post("/revise", async (req, res, next) => {
    try {
      const data = await scriptwriter.revise(req.body);
      res.status(201).json({ requestId: req.requestId, data });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "SCRIPT_INTERNAL_ERROR", "CreatorPilot could not revise the script.", true));
    }
  });

  router.post("/review", async (req, res, next) => {
    try {
      const data = await originalityReviewer.review(req.body);
      res.json({ requestId: req.requestId, data });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "REVIEW_INTERNAL_ERROR", "CreatorPilot could not review the script.", true));
    }
  });

  return router;
}

module.exports = { createScriptsRouter };
