const express = require("express");
const { AppError } = require("../middleware/error-handler");

function createResearchRouter(researcher) {
  const router = express.Router();
  router.post("/topic", async (req, res, next) => {
    try {
      const data = await researcher.research(req.body);
      res.status(201).json({ requestId: req.requestId, data });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "RESEARCH_INTERNAL_ERROR", "CreatorPilot could not research this topic.", true));
    }
  });
  return router;
}

module.exports = { createResearchRouter };

