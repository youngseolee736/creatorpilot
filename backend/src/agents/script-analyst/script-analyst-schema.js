const { AppError } = require("../../middleware/error-handler");

const MIN_TRANSCRIPT_WORDS = 1;
const MAX_TRANSCRIPT_CHARACTERS = 100000;
const MIN_TARGET_DURATION = 1;
const MAX_TARGET_DURATION = 7200;

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

  const targetTopic = typeof input.targetTopic === "string" ? input.targetTopic.replace(/\s+/g, " ").trim() : "";
  if (targetTopic.length < 3 || targetTopic.length > 200) {
    throw new AppError(400, "INVALID_ANALYSIS_REQUEST", "targetTopic is required.", false, detail("targetTopic", "required"));
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
    targetTopic,
    targetDurationSeconds,
    analysisLanguage: analysisLanguage || "English",
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

function validateSynthesisRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "The synthesis request must be a JSON object.", false);
  }
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  const targetTopic = typeof input.targetTopic === "string" ? input.targetTopic.replace(/\s+/g, " ").trim() : "";
  const targetDurationSeconds = Number(input.targetDurationSeconds);
  const analysisLanguage = input.analysisLanguage == null ? "English" : String(input.analysisLanguage).trim();
  const analysisMode = input.analysisMode == null ? "standard" : String(input.analysisMode).trim().toLowerCase();
  if (!projectId || projectId.length > 128) {
    throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "projectId is required.", false, detail("projectId", "required"));
  }
  if (targetTopic.length < 3 || targetTopic.length > 200) {
    throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "targetTopic is required.", false, detail("targetTopic", "required"));
  }
  if (!Number.isInteger(targetDurationSeconds) || targetDurationSeconds < MIN_TARGET_DURATION || targetDurationSeconds > MAX_TARGET_DURATION) {
    throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", `targetDurationSeconds must be an integer from ${MIN_TARGET_DURATION} to ${MAX_TARGET_DURATION}.`, false, detail("targetDurationSeconds", "unsupported"));
  }
  if (!validLanguage(analysisLanguage)) {
    throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "The analysis language is invalid.", false, detail("analysisLanguage", "invalid"));
  }
  if (!["standard", "deep"].includes(analysisMode)) {
    throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "analysisMode must be standard or deep.", false, detail("analysisMode", "invalid_enum"));
  }
  if (!Array.isArray(input.analyses) || input.analyses.length < 3 || input.analyses.length > 5) {
    throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "Three to five reference analyses are required.", false, detail("analyses", "invalid_array"));
  }
  const analyses = input.analyses.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item) || !item.analysis || typeof item.analysis !== "object") {
      throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "Every reference must include an analysis.", false, detail(`analyses.${index}.analysis`, "required"));
    }
    const analysisId = typeof item.analysis.analysisId === "string" ? item.analysis.analysisId.trim() : "";
    if (!analysisId || !Array.isArray(item.analysis.structure) || !item.analysis.hookMechanics || !item.analysis.narrativeStyle) {
      throw new AppError(400, "INVALID_SYNTHESIS_REQUEST", "A complete Script Analyst result is required for every reference.", false, detail(`analyses.${index}.analysis`, "invalid"));
    }
    return {
      referenceId: String(item.referenceId || `reference-${index + 1}`).slice(0, 128),
      title: String(item.title || `Reference ${index + 1}`).replace(/\s+/g, " ").trim().slice(0, 200),
      analysis: item.analysis,
    };
  });
  return { projectId, targetTopic, targetDurationSeconds, analysisLanguage, analysisMode, analyses };
}

module.exports = {
  MAX_TRANSCRIPT_CHARACTERS,
  MAX_TARGET_DURATION,
  MIN_TARGET_DURATION,
  MIN_TRANSCRIPT_WORDS,
  validateAnalysisRequest,
  validateSynthesisRequest,
  validLanguage,
};
