const { AppError } = require("../../middleware/error-handler");

function mapTranscriptError(error) {
  if (error instanceof AppError) return error;

  const name = String(error && (error.name || error.constructor?.name) || "");
  const message = String(error && error.message || "");
  const signature = `${name} ${message}`;

  if (/AbortError|aborted|timeout/i.test(signature)) {
    return new AppError(504, "TRANSCRIPT_TIMEOUT", "The transcript provider took too long to respond.", true);
  }
  if (/TooManyRequest|captcha|too many requests|rate limit/i.test(signature)) {
    return new AppError(429, "PROVIDER_RATE_LIMITED", "YouTube temporarily blocked transcript requests. Try again later.", true);
  }
  if (/VideoUnavailable|video (is )?(no longer )?available|private video/i.test(signature)) {
    return new AppError(404, "VIDEO_NOT_FOUND", "This YouTube video is unavailable or not public.", false);
  }
  if (/Disabled|captions? (are )?disabled/i.test(signature)) {
    return new AppError(404, "TRANSCRIPT_UNAVAILABLE", "Captions are disabled for this video.", false);
  }
  if (/NotAvailableLanguage|No transcripts? are available in/i.test(signature)) {
    return new AppError(404, "TRANSCRIPT_UNAVAILABLE", "A transcript is not available in the requested language.", false);
  }
  if (/NotAvailable|No transcripts?|transcript not found/i.test(signature)) {
    return new AppError(404, "TRANSCRIPT_UNAVAILABLE", "A transcript is not available for this video.", false);
  }
  if (/invalid video|invalid youtube|video id/i.test(signature)) {
    return new AppError(400, "INVALID_YOUTUBE_URL", "Enter a valid public YouTube video URL.", false);
  }
  if (/blocked|forbidden|status code 403|ECONNRESET|ENOTFOUND|EAI_AGAIN|network|fetch/i.test(signature)) {
    return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "YouTube temporarily blocked or interrupted transcript access.", true);
  }
  if (/markup|parse|parser|unexpected token|response format/i.test(signature)) {
    return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "YouTube changed the transcript response format.", true);
  }
  return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "CreatorPilot could not extract this transcript.", true);
}

module.exports = { mapTranscriptError };
