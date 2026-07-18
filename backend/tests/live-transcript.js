const http = require("http");

const youtubeUrl = process.env.LIVE_YOUTUBE_URL;
const backendUrl = new URL(process.env.BACKEND_URL || "http://127.0.0.1:8787");

if (!youtubeUrl) {
  console.log("SKIP: Set LIVE_YOUTUBE_URL to run the rate-limited provider integration test.");
  process.exit(0);
}

const payload = JSON.stringify({
  projectId: "project-live-check",
  youtubeUrl,
  targetLanguage: process.env.LIVE_TARGET_LANGUAGE || "English",
});

const request = http.request({
  hostname: backendUrl.hostname,
  port: backendUrl.port || 80,
  path: "/api/transcripts/extract",
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  },
}, (response) => {
  let body = "";
  response.setEncoding("utf8");
  response.on("data", (chunk) => { body += chunk; });
  response.on("end", () => {
    const parsed = JSON.parse(body);
    if (response.statusCode !== 200) {
      console.error(`Live transcript check failed (${response.statusCode}):`, parsed.error);
      process.exitCode = 1;
      return;
    }
    console.log({
      requestId: parsed.requestId,
      title: parsed.data.title,
      language: parsed.data.language,
      wordCount: parsed.data.wordCount,
      estimatedDuration: parsed.data.estimatedDuration,
      segments: parsed.data.segments.length,
    });
  });
});

request.on("error", (error) => {
  console.error("Could not reach the CreatorPilot backend:", error.message);
  process.exitCode = 1;
});
request.write(payload);
request.end();
