const express = require("express");
const { AppError } = require("../middleware/error-handler");

function createAnalysisRouter(scriptAnalyst) {
  const router = express.Router();

  router.post("/reference", async (req, res, next) => {
    try {
      const data = await scriptAnalyst.analyze(req.body);
      res.status(200).json({ requestId: req.requestId, data });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "ANALYSIS_INTERNAL_ERROR", "CreatorPilot could not complete the analysis.", true));
    }
  });

  return router;
}

module.exports = { createAnalysisRouter };
