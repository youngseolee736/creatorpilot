const assert = require("assert");
const { OriginalityReviewer } = require("../src/agents/originality-reviewer/originality-reviewer");
const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { Scriptwriter } = require("../src/agents/scriptwriter/scriptwriter");
const { StoryboardAgent } = require("../src/agents/storyboard/storyboard");
const { VideoProducer } = require("../src/agents/video-producer/video-producer");
const { TranscriptService } = require("../src/services/transcript-service");
const { hasLLMConfiguration } = require("../src/services/llm");
const { extractYouTubeVideo } = require("../src/utils/youtube-url");

const missingVariables = ["ANALYST", "SCRIPTWRITER", "REVIEWER", "STORYBOARD"]
  .filter((scope) => !hasLLMConfiguration(scope))
  .map((scope) => `${scope}_LLM_* (or shared LLM_*)`);
const renderVariables = String(process.env.RENDER_PROVIDER || "http").toLowerCase() === "shotstack"
  ? ["SHOTSTACK_API_URL", "SHOTSTACK_API_KEY"]
  : ["RENDER_API_BASE_URL", "RENDER_API_KEY"];
for (const name of ["LIVE_SCRIPT_TOPIC", ...renderVariables]) {
  if (!String(process.env[name] || "").trim()) missingVariables.push(name);
}
if (missingVariables.length) {
  console.log(`SKIP: Live render test requires ${missingVariables.join(", ")}.`);
  process.exit(0);
}

const video = extractYouTubeVideo(process.env.LIVE_YOUTUBE_URL || "https://www.youtube.com/watch?v=jNQXAC9IVRw");
if (!video) {
  console.error("Live render test requires a valid public YouTube URL.");
  process.exit(1);
}

(async () => {
  const projectId = "project-live-render";
  const targetLanguage = process.env.LIVE_TARGET_LANGUAGE || "English";
  const durationSeconds = Number(process.env.LIVE_TARGET_DURATION || 60);
  const transcript = await new TranscriptService().extract({ projectId, targetLanguage, ...video });
  const analysis = await new ScriptAnalyst().analyze({ projectId, transcript, targetDurationSeconds: durationSeconds, analysisLanguage: targetLanguage });
  const script = await new Scriptwriter().generate({
    projectId, topic: process.env.LIVE_SCRIPT_TOPIC, targetLanguage,
    targetDurationSeconds: durationSeconds, audience: analysis.targetAudience,
    referenceAnalysis: analysis, revisionInstructions: [],
  });
  const reviewer = new OriginalityReviewer();
  const review = await reviewer.review({ projectId, referenceTranscript: transcript, referenceAnalysis: analysis, script });
  if (review.status !== "passed") {
    console.log({ reviewId: review.reviewId, status: review.status, note: "SKIP: live script requires revision before rendering." });
    return;
  }
  const storyboardAgent = new StoryboardAgent({ reviewResolver: (id) => reviewer.findReview(id) });
  const storyboard = await storyboardAgent.generate({
    projectId, approvedReviewId: review.reviewId, script, format: "9:16",
    targetDurationSeconds: durationSeconds, sceneCount: 8,
    visualConstraints: ["Use licensed, original, or generated assets only."],
  });
  const producer = new VideoProducer({
    reviewResolver: (id) => reviewer.findReview(id),
    storyboardResolver: (reviewId, scenes) => storyboardAgent.findStoryboard(reviewId, scenes),
  });
  let status = await producer.start({
    projectId, approvedReviewId: review.reviewId, storyboard: storyboard.scenes,
    productionSettings: { voice: "Min — Clear explainer", captions: "Editorial high contrast", music: false },
    format: "9:16", durationSeconds,
  });
  for (let poll = 0; poll < 240 && !status.completed && status.status !== "failed"; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    status = await producer.status(status.renderId);
  }
  assert.equal(status.status, "completed");
  assert.equal(status.completed, true);
  assert.match(status.videoUrl, /^https:/);
  console.log({ renderId: status.renderId, status: status.status, videoUrl: status.videoUrl });
})().catch((error) => {
  console.error("Live render test failed:", error.code || error.name || "ERROR", error.message);
  if (Array.isArray(error.details)) console.error("Validation details:", JSON.stringify(error.details));
  process.exitCode = 1;
});
