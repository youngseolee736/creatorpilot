const fetch = require("node-fetch");
const AbortController = require("abort-controller");

const endpoint = process.env.TRANSCRIPT_API_URL || "https://youtube-transcript-api-tau-one.vercel.app/transcript";
const youtubeUrl = process.env.LIVE_YOUTUBE_URL || "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const previewLimit = 500;

function transcriptShape(payload) {
  const candidates = [payload, payload?.data].filter((value) => value && typeof value === "object");
  return {
    parsedJsonType: Array.isArray(payload) ? "array" : typeof payload,
    responseKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload) : [],
    hasTranscriptText: candidates.some((value) => typeof value.text === "string" && value.text.trim().length > 0),
    hasTranscriptSegments: candidates.some((value) => Array.isArray(value.segments) && value.segments.length > 0)
      || Array.isArray(payload) && payload.length > 0,
  };
}

async function diagnose(requestField) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ [requestField]: youtubeUrl }),
      signal: controller.signal,
    });
    const rawBody = await response.text();
    let payload = null;
    try { payload = JSON.parse(rawBody); } catch {}
    return {
      requestField,
      status: response.status,
      contentType: response.headers.get("content-type"),
      rawBodyPreview: rawBody.slice(0, previewLimit),
      ...(payload === null
        ? { parsedJsonType: "invalid-json", responseKeys: [], hasTranscriptText: false, hasTranscriptSegments: false }
        : transcriptShape(payload)),
    };
  } catch (error) {
    return { requestField, networkError: error.name === "AbortError" ? "timeout" : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

Promise.all([diagnose("video_url"), diagnose("url")])
  .then((results) => console.log(JSON.stringify(results, null, 2)))
  .catch((error) => {
    console.error("Provider diagnostic failed:", error.message);
    process.exitCode = 1;
  });
