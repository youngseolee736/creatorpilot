const assert = require("assert");
const { OriginalityReviewer } = require("../src/agents/originality-reviewer/originality-reviewer");
const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { Scriptwriter } = require("../src/agents/scriptwriter/scriptwriter");
const { StoryboardAgent } = require("../src/agents/storyboard/storyboard");
const { TranscriptService } = require("../src/services/transcript-service");
const { hasLLMConfiguration } = require("../src/services/llm");
const { extractYouTubeVideo } = require("../src/utils/youtube-url");

const missingVariables = ["ANALYST", "SCRIPTWRITER", "REVIEWER", "STORYBOARD"]
  .filter((scope) => !hasLLMConfiguration(scope))
  .map((scope) => `${scope}_LLM_* (or shared LLM_*)`);
if (!String(process.env.LIVE_SCRIPT_TOPIC || "").trim()) missingVariables.push("LIVE_SCRIPT_TOPIC");

if (missingVariables.length) {
  console.log(`SKIP: Live Storyboard test requires ${missingVariables.join(", ")}.`);
  process.exit(0);
}

const youtubeUrl = process.env.LIVE_YOUTUBE_URL || "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const video = extractYouTubeVideo(youtubeUrl);
if (!video) {
  console.error("Live Storyboard test requires a valid public YouTube URL.");
  process.exit(1);
}

(async () => {
  const projectId = "project-live-storyboard";
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
  const reviewer = new OriginalityReviewer();
  const review = await reviewer.review({ projectId, referenceTranscript: transcript, referenceAnalysis: analysis, script });
  if (review.status !== "passed") {
    console.log({ reviewId: review.reviewId, status: review.status, note: "SKIP: live script requires revision before Storyboard." });
    return;
  }
  const storyboard = await new StoryboardAgent({
    reviewResolver: (reviewId) => reviewer.findReview(reviewId),
  }).generate({
    projectId,
    approvedReviewId: review.reviewId,
    script,
    format: "9:16",
    targetDurationSeconds,
    sceneCount: 8,
    visualConstraints: ["Use licensed, original, or generated assets only."],
  });

  assert.match(storyboard.storyboardId, /^storyboard_/);
  assert.equal(storyboard.scriptId, script.scriptId);
  assert.equal(storyboard.totalDuration, targetDurationSeconds);
  assert.equal(storyboard.scenes[storyboard.scenes.length - 1].end, targetDurationSeconds);
  console.log({
    reviewId: review.reviewId,
    storyboardId: storyboard.storyboardId,
    scenes: storyboard.scenes.length,
    totalDuration: storyboard.totalDuration,
  });
})().catch((error) => {
  console.error("Live Storyboard test failed:", error.code || error.name || "ERROR", error.message);
  if (Array.isArray(error.details)) console.error("Validation details:", JSON.stringify(error.details));
  process.exitCode = 1;
});
