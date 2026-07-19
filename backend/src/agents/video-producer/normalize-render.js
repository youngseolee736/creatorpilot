const crypto = require("crypto");
const { AppError } = require("../../middleware/error-handler");

function invalid(reason) {
  return new AppError(
    502,
    "INVALID_RENDER_RESPONSE",
    "The render provider returned a response that did not match the required contract.",
    true,
    [{ field: "provider", reason }],
  );
}

function requestFingerprint(input) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function stringField(value, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw invalid("required_string");
  return value.replace(/\s+/g, " ").trim();
}

function progressValue(value, { terminal = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw invalid("invalid_progress");
  const rounded = Math.round(number);
  if (!terminal && rounded >= 100) throw invalid("non_terminal_progress");
  return terminal ? 100 : rounded;
}

function safeUrl(value) {
  const normalized = stringField(value, 2000);
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") throw new Error("unsafe");
    return url.toString();
  } catch {
    throw invalid("invalid_delivery_url");
  }
}

function completedAt(value) {
  if (value == null || value === "") return new Date().toISOString();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw invalid("invalid_completed_at");
  return date.toISOString();
}

function normalizeStart(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("invalid_object");
  const status = String(raw.status || "").toLowerCase();
  if (!["queued", "running"].includes(status)) throw invalid("invalid_start_status");
  return {
    providerJobId: stringField(raw.jobId, 200),
    status,
    stage: stringField(raw.stage || (status === "queued" ? "Preparing production" : "Planning scenes"), 200),
    progress: progressValue(raw.progress ?? (status === "queued" ? 2 : 5)),
  };
}

function normalizeStatus(raw, job) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("invalid_object");
  const status = String(raw.status || "").toLowerCase();
  const base = { renderId: job.renderId, source: "provider" };
  if (["queued", "running"].includes(status)) {
    return {
      ...base,
      status,
      stage: stringField(raw.stage || "Rendering video", 200),
      progress: progressValue(raw.progress ?? 5),
      completed: false,
      updatedAt: new Date().toISOString(),
    };
  }
  if (status === "completed") {
    return {
      ...base,
      status: "completed",
      stage: "Final video ready",
      progress: progressValue(100, { terminal: true }),
      completed: true,
      format: job.input.format,
      duration: job.input.durationSeconds,
      voice: job.input.productionSettings.voice,
      captionStyle: job.input.productionSettings.captions,
      music: job.input.productionSettings.music,
      completedAt: completedAt(raw.completedAt),
      videoUrl: safeUrl(raw.videoUrl),
      productionPackageUrl: safeUrl(raw.productionPackageUrl),
    };
  }
  if (status === "failed") {
    return {
      ...base,
      status: "failed",
      stage: "Render failed",
      progress: Math.min(99, Math.max(0, Math.round(Number(raw.progress) || job.publicStatus.progress || 0))),
      completed: false,
      error: {
        code: "RENDER_FAILED",
        message: "The render provider could not complete the video.",
        retryable: true,
      },
    };
  }
  throw invalid("invalid_status");
}

module.exports = { normalizeStart, normalizeStatus, requestFingerprint };
