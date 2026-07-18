class AppError extends Error {
  constructor(status, code, message, retryable = false, details = null) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(404, "ROUTE_NOT_FOUND", "The requested API route does not exist.", false));
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  let normalized = error;
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    normalized = new AppError(400, "INVALID_JSON", "The request body must contain valid JSON.", false);
  } else if (error && error.type === "entity.too.large") {
    normalized = new AppError(413, "TRANSCRIPT_TOO_LARGE", "The analysis request is too large.", false);
  }

  if (!(normalized instanceof AppError)) {
    console.error("Unexpected backend error", {
      requestId: req.requestId,
      name: normalized.name,
      message: normalized.message,
    });
    normalized = new AppError(500, "INTERNAL_ERROR", "CreatorPilot could not complete the request.", true);
  }

  const body = {
    requestId: req.requestId,
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
    },
  };
  if (normalized.details) body.error.details = normalized.details;
  res.status(normalized.status).json(body);
}

module.exports = { AppError, errorHandler, notFoundHandler };
