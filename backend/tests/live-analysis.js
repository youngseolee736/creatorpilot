const assert = require("assert");
const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { TranscriptService } = require("../src/services/transcript-service");
const { hasLLMConfiguration } = require("../src/services/llm");
const { extractYouTubeVideo } = require("../src/utils/youtube-url");

const missingVariables = hasLLMConfiguration("ANALYST") ? [] : ["ANALYST_LLM_* (or shared LLM_*)"];

if (missingVariables.length) {
  console.log(`SKIP: Live Script Analyst test requires ${missingVariables.join(", ")}.`);
  process.exit(0);
}

const youtubeUrl = process.env.LIVE_YOUTUBE_URL || "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const video = extractYouTubeVideo(youtubeUrl);
if (!video) {
  console.error("Live Script Analyst test requires a valid public YouTube URL.");
  process.exit(1);
}

(async () => {
  const transcript = await new TranscriptService().extract({
    projectId: "project-live-analysis",
    targetLanguage: process.env.LIVE_TARGET_LANGUAGE || "English",
    ...video,
  });
  const analysis = await new ScriptAnalyst().analyze({
    projectId: "project-live-analysis",
    transcript,
    targetDurationSeconds: Number(process.env.LIVE_TARGET_DURATION || 60),
    analysisLanguage: process.env.LIVE_ANALYSIS_LANGUAGE || "English",
  });

  assert.ok(transcript.text.trim());
  assert.ok(transcript.segments.length > 0);
  assert.ok(analysis.structure.length >= 2);
  assert.equal(analysis.safety.longSourceExcerptsIncluded, false);
  assert.equal(analysis.safety.maxQuotedWords, 0);

  const { renderAnalysis } = await import("../../frontend/pages/analysis.mjs");
  const html = renderAnalysis({
    id: "project-live-analysis",
    topic: "Live analysis verification",
    language: process.env.LIVE_ANALYSIS_LANGUAGE || "English",
    duration: Number(process.env.LIVE_TARGET_DURATION || 60),
    format: "9:16",
    error: null,
    transcript,
    analysis,
  });
  assert.ok(html.includes(analysis.hookType));
  assert.ok(html.includes("confidence"));
  assert.ok(!html.includes("CreatorPilot's Script Analyst Agent"));

  console.log({
    transcriptWordCount: transcript.wordCount,
    transcriptSegments: transcript.segments.length,
    analysisId: analysis.analysisId,
    structureSections: analysis.structure.length,
    confidence: analysis.confidence,
    analysisScreenRendered: true,
  });
})().catch((error) => {
  console.error("Live Script Analyst test failed:", error.code || error.name || "ERROR", error.message);
  if (Array.isArray(error.details)) {
    console.error("Validation details:", JSON.stringify(error.details));
  }
  process.exitCode = 1;
});
