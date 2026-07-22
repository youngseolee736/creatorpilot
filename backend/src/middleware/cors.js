const { AppError } = require("./error-handler");

function createCorsMiddleware(frontendOrigin) {
  const allowedOrigin = String(frontendOrigin || "http://127.0.0.1:4173").replace(/\/$/, "");

  return function corsMiddleware(req, res, next) {
    const origin = req.get("Origin");
    res.vary("Origin");

    let sameOrigin = false;
    if (origin) {
      try {
        sameOrigin = new URL(origin).host === req.get("host");
      } catch {
        sameOrigin = false;
      }
    }

    if (origin && !sameOrigin && origin.replace(/\/$/, "") !== allowedOrigin) {
      return next(new AppError(403, "ORIGIN_NOT_ALLOWED", "This browser origin is not allowed to call CreatorPilot.", false));
    }

    if (origin) res.set("Access-Control-Allow-Origin", sameOrigin ? origin : allowedOrigin);
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type,Accept");
    res.set("Access-Control-Max-Age", "600");

    if (req.method === "OPTIONS") return res.status(204).end();
    return next();
  };
}

module.exports = { createCorsMiddleware };
