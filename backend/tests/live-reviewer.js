const assert = require("assert");
const { OriginalityReviewer } = require("../src/agents/originality-reviewer/originality-reviewer");
const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { Scriptwriter } = require("../src/agents/scriptwriter/scriptwriter");
const { TranscriptService } = require("../src/services/transcript-service");
const { hasLLMConfiguration } = require("../src/services/llm");
const { extractYouTubeVideo } = require("../src/utils/youtube-url");

const missingVariables = ["ANALYST", "SCRIPTWRITER", "REVIEWER"]
  .filter((scope) => !hasLLMConfiguration(scope))
  .map((scope) => `${scope}_LLM_* (or shared LLM_*)`);
if (!String(process.env.LIVE_SCRIPT_TOPIC || "").trim()) missingVariables.push("LIVE_SCRIPT_TOPIC");

if (missingVariables.length) {
  console.log(`SKIP: Live Reviewer test requires ${missingVariables.join(", ")}.`);
  process.exit(0);
}

const youtubeUrl = process.env.LIVE_YOUTUBE_URL || "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const video = extractYouTubeVideo(youtubeUrl);
if (!video) {
  console.error("Live Reviewer test requires a valid public YouTube URL.");
  process.exit(1);
}

(async () => {
  const projectId = "project-live-reviewer";
  const targetLanguage = process.env.LIVE_TARGET_LANGUAGE || "English";
  const targetDurationSeconds = Number(process.env.LIVE_TARGET_DURATION || 60);
  const transcript = await new TranscriptService().extract({ projectId, targetLanguage, ...video });
  const analysis = await new ScriptAnalyst().analyze({ projectId, transcript, targetDurationSeconds, analysisLanguage: targetLanguage });
  const script = await new Scriptwriter().generate({
    projectId,
    topic: process.env.LIVE_SCRIPT_TOPIC,
    targetLanguage,
    targetDurationSeconds,
    audience: analysis.targetAudience,
    referenceAnalysis: analysis,
    revisionInstructions: [],
  });
  const review = await new OriginalityReviewer().review({
    projectId,
    referenceTranscript: transcript,
    referenceAnalysis: analysis,
    script,
  });

  assert.match(review.reviewId, /^review_/);
  assert.equal(review.scriptId, script.scriptId);
  assert.ok(["passed", "failed"].includes(review.status));
  assert.ok(review.overall >= 0 && review.overall <= 100);
  assert.match(review.disclaimer, /not a copyright or legal determination/);
  console.log({
    analysisId: analysis.analysisId,
    scriptId: script.scriptId,
    reviewId: review.reviewId,
    status: review.status,
    overall: review.overall,
  });
})().catch((error) => {
  console.error("Live Reviewer test failed:", error.code || error.name || "ERROR", error.message);
  if (Array.isArray(error.details)) console.error("Validation details:", JSON.stringify(error.details));
  process.exitCode = 1;
});
