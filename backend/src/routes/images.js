const express = require("express");
const { AppError } = require("../middleware/error-handler");

function createImagesRouter(imageProvider) {
  const router = express.Router();

  router.post("/generate", async (req, res, next) => {
    try {
      const image = await imageProvider.generate(req.body);
      res.status(201).json({ requestId: req.requestId, data: image });
    } catch (error) {
      next(error instanceof AppError
        ? error
        : new AppError(500, "IMAGE_INTERNAL_ERROR", "CreatorPilot could not generate the storyboard image.", true));
    }
  });

  return router;
}

module.exports = { createImagesRouter };
