const { AppError } = require("../../middleware/error-handler");

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
  if (!normalized) return null;
  const aliases = { english: "en", korean: "ko", spanish: "es", french: "fr", german: "de", japanese: "ja" };
  return aliases[normalized] || normalized.split(/[-_]/)[0] || null;
}

function usesMillisecondOffsets(items) {
  const durations = items
    .map((item) => Number(item && item.duration))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!durations.length) return false;
  return durations[Math.floor(durations.length / 2)] > 100;
}

function normalizeSegments(items) {
  if (!Array.isArray(items)) return [];
  const offsetMilliseconds = usesMillisecondOffsets(items);
  return items.map((item, index) => {
    const text = cleanText(typeof item === "string" ? item : item && item.text);
    if (!text) return null;

    const usesOffset = item && item.start == null && item.offset != null;
    const divisor = usesOffset && offsetMilliseconds ? 1000 : 1;
    const rawStart = Number(item && (item.start ?? item.offset));
    const start = Number.isFinite(rawStart) ? rawStart / divisor : index;
    const rawDuration = Number(item && item.duration);
    const rawEnd = Number(item && item.end);
    const duration = Number.isFinite(rawDuration) ? rawDuration / divisor : null;
    const end = Number.isFinite(rawEnd) ? rawEnd : start + (duration != null ? duration : 1);
    const normalizedStart = Math.round(Math.max(0, start) * 1000) / 1000;
    const normalizedEnd = Math.round(Math.max(start, end) * 1000) / 1000;
    return { start: normalizedStart, end: normalizedEnd, text };
  }).filter(Boolean);
}

function isMalformedTranscript(text) {
  if (!text || text.split(/\s+/).length < 3) return true;
  return /^\d+:\{.*"\$@/s.test(text) || /"a":"\$@\d+"/.test(text);
}

function normalizeTranscript(payload, context) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "The transcript provider returned an invalid response.", true);
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
    title: cleanText(candidate.title || candidate.videoTitle || candidate.video_title || candidate.metadata?.title) || null,
    text,
    language: languageCode(candidate.language || candidate.languageCode || candidate.lang || segmentCandidates[0]?.lang),
    wordCount,
    estimatedDuration,
    segments,
  };
}

module.exports = { cleanText, languageCode, normalizeSegments, normalizeTranscript };
