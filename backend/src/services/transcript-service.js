const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const { AppError } = require("../middleware/error-handler");

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function languageCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = { english: "en", korean: "ko", spanish: "es", french: "fr", german: "de", japanese: "ja" };
  return aliases[normalized] || normalized.split(/[-_]/)[0] || "und";
}

function normalizeSegments(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const text = cleanText(typeof item === "string" ? item : item && item.text);
    if (!text) return null;

    const rawStart = Number(item && (item.start ?? item.offset));
    const offsetLooksLikeMilliseconds = item && item.start == null && item.offset != null;
    const start = Number.isFinite(rawStart) ? rawStart / (offsetLooksLikeMilliseconds ? 1000 : 1) : index;
    const rawDuration = Number(item && item.duration);
    const rawEnd = Number(item && item.end);
    const duration = Number.isFinite(rawDuration) ? rawDuration / (offsetLooksLikeMilliseconds ? 1000 : 1) : null;
    const end = Number.isFinite(rawEnd) ? rawEnd : start + (duration != null ? duration : 1);
    return { start: Math.max(0, start), end: Math.max(start, end), text };
  }).filter(Boolean);
}

function isMalformedTranscript(text) {
  if (!text || text.split(/\s+/).length < 3) return true;
  return /^\d+:\{.*"\$@/s.test(text) || /"a":"\$@\d+"/.test(text);
}

function normalizeProviderPayload(payload, context) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider returned an invalid response.", true);
  }

  const providerError = payload.error || (payload.status === "error" ? payload.message || payload.detail : null);
  if (providerError) {
    const message = cleanText(typeof providerError === "string" ? providerError : providerError.message);
    if (/not found|no transcript|disabled|unavailable|private/i.test(message)) {
      throw new AppError(404, "TRANSCRIPT_UNAVAILABLE", "A transcript is not available for this video.", false);
    }
    throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider could not process this video.", true);
  }

  const candidate = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const segmentCandidates = Array.isArray(candidate.segments)
    ? candidate.segments
    : Array.isArray(candidate.transcript)
      ? candidate.transcript
      : Array.isArray(candidate.transcripts)
        ? candidate.transcripts
        : [];
  let segments = normalizeSegments(segmentCandidates);
  let text = cleanText(typeof candidate.transcript === "string" ? candidate.transcript : candidate.text);
  if (!text && segments.length) text = cleanText(segments.map((segment) => segment.text).join(" "));

  if (isMalformedTranscript(text)) {
    throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider returned transcript data in an unsupported format.", true);
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lastSegment = segments[segments.length - 1];
  const estimatedDuration = lastSegment
    ? Math.max(1, Math.round(lastSegment.end))
    : Math.max(1, Math.round(wordCount / 2.5));
  if (!segments.length) segments = [{ start: 0, end: estimatedDuration, text }];

  return {
    transcriptId: `tr_${context.videoId}`,
    source: "youtube_captions",
    title: cleanText(candidate.title || candidate.videoTitle || candidate.video_title) || `YouTube video ${context.videoId}`,
    text,
    language: languageCode(candidate.language || candidate.languageCode || context.preferredCaptionLanguage || context.targetLanguage),
    wordCount,
    estimatedDuration,
    segments,
  };
}

function upstreamError(status) {
  if (status === 404) return new AppError(404, "TRANSCRIPT_UNAVAILABLE", "A transcript is not available for this video.", false);
  if (status === 429) return new AppError(429, "PROVIDER_RATE_LIMITED", "The transcript provider rate limit was reached. Try again in a minute.", true);
  if (status === 408 || status === 504) return new AppError(504, "TRANSCRIPT_TIMEOUT", "The transcript provider took too long to respond.", true);
  return new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider could not complete the request.", status >= 500);
}

class TranscriptService {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || process.env.TRANSCRIPT_API_URL || "https://youtube-transcript-api-tau-one.vercel.app/transcript";
    this.timeoutMs = Number(options.timeoutMs || process.env.TRANSCRIPT_TIMEOUT_MS || 10000);
    this.fetchImpl = options.fetchImpl || fetch;
    this.AbortControllerImpl = options.AbortControllerImpl || AbortController;
  }

  async extract(context) {
    const controller = new this.AbortControllerImpl();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    let rawBody;

    try {
      response = await this.fetchImpl(this.apiUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ url: context.canonicalUrl }),
        signal: controller.signal,
      });
      rawBody = await response.text();
    } catch (error) {
      if (error.name === "AbortError" || controller.signal.aborted) {
        throw new AppError(504, "TRANSCRIPT_TIMEOUT", "The transcript provider took too long to respond.", true);
      }
      if (response) {
        throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider response could not be read.", true);
      }
      throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "CreatorPilot could not reach the transcript provider.", true);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) throw upstreamError(response.status);

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider returned malformed JSON.", true);
    }

    return normalizeProviderPayload(payload, context);
  }
}

module.exports = { TranscriptService, normalizeProviderPayload };
