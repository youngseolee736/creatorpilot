const { AppError } = require("../../middleware/error-handler");

const MIN_TRANSCRIPT_WORDS = 8;
const MAX_TRANSCRIPT_CHARACTERS = 100000;
const MIN_TARGET_DURATION = 15;
const MAX_TARGET_DURATION = 180;

function detail(field, reason) {
  return [{ field, reason }];
}

function validLanguage(value) {
  return typeof value === "string"
    && value.trim().length >= 2
    && value.trim().length <= 64
    && /^[\p{L}\p{N} _-]+$/u.test(value.trim());
}

function validateAnalysisRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "The analysis request must be a JSON object.", false);
  }

  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  if (!projectId || projectId.length > 128) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "projectId is required.", false, detail("projectId", "required"));
  }

  const transcript = input.transcript;
  if (!transcript || typeof transcript !== "object" || Array.isArray(transcript)) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "A normalized transcript is required.", false, detail("transcript", "required"));
  }
  const transcriptId = typeof transcript.transcriptId === "string" ? transcript.transcriptId.trim() : "";
  if (!transcriptId) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "The transcriptId is required.", false, detail("transcript.transcriptId", "required"));
  }
  const text = typeof transcript.text === "string" ? transcript.text.trim() : "";
  if (!text) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "Transcript text is required.", false, detail("transcript.text", "required"));
  }
  if (text.length > MAX_TRANSCRIPT_CHARACTERS) {
    throw new AppError(413, "TRANSCRIPT_TOO_LARGE", "This transcript is too large for the Phase 2 Script Analyst.", false);
  }
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_TRANSCRIPT_WORDS) {
    throw new AppError(422, "TRANSCRIPT_NOT_ANALYZABLE", "The transcript is too short to analyze reliably.", false);
  }
  if (transcript.language != null && !validLanguage(transcript.language)) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "The transcript language is invalid.", false, detail("transcript.language", "invalid"));
  }
  if (!Array.isArray(transcript.segments)) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "Transcript segments must be an array.", false, detail("transcript.segments", "invalid"));
  }

  const targetDurationSeconds = Number(input.targetDurationSeconds);
  if (!Number.isInteger(targetDurationSeconds)
    || targetDurationSeconds < MIN_TARGET_DURATION
    || targetDurationSeconds > MAX_TARGET_DURATION) {
    throw new AppError(
      400,
      "INVALID_ANALYSIS_REQUEST",
      `targetDurationSeconds must be an integer from ${MIN_TARGET_DURATION} to ${MAX_TARGET_DURATION}.`,
      false,
      detail("targetDurationSeconds", "unsupported"),
    );
  }
  const analysisLanguage = input.analysisLanguage == null ? null : String(input.analysisLanguage).trim();
  if (analysisLanguage != null && !validLanguage(analysisLanguage)) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "The analysis language is invalid.", false, detail("analysisLanguage", "invalid"));
  }

  return {
    projectId,
    targetDurationSeconds,
    analysisLanguage: "English",
    transcript: {
      transcriptId,
      language: transcript.language || null,
      text,
      wordCount: Number.isInteger(transcript.wordCount) ? transcript.wordCount : wordCount,
      estimatedDuration: Number(transcript.estimatedDuration) || null,
      segments: transcript.segments,
    },
  };
}

module.exports = {
  MAX_TRANSCRIPT_CHARACTERS,
  MAX_TARGET_DURATION,
  MIN_TARGET_DURATION,
  MIN_TRANSCRIPT_WORDS,
  validateAnalysisRequest,
  validLanguage,
};
