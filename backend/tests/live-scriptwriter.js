const assert = require("assert");
const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { Scriptwriter } = require("../src/agents/scriptwriter/scriptwriter");
const { TranscriptService } = require("../src/services/transcript-service");
const { extractYouTubeVideo } = require("../src/utils/youtube-url");

const requiredVariables = ["LLM_API_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "LIVE_SCRIPT_TOPIC"];
const missingVariables = requiredVariables.filter((name) => !String(process.env[name] || "").trim());

if (missingVariables.length) {
  console.log(`SKIP: Live Scriptwriter test requires ${missingVariables.join(", ")}.`);
  process.exit(0);
}

const youtubeUrl = process.env.LIVE_YOUTUBE_URL || "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const video = extractYouTubeVideo(youtubeUrl);
if (!video) {
  console.error("Live Scriptwriter test requires a valid public YouTube URL.");
  process.exit(1);
}

(async () => {
  const projectId = "project-live-scriptwriter";
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

  assert.match(script.scriptId, /^script_/);
  assert.equal(script.version, 1);
  assert.equal(script.sections.length, analysis.structure.length);
  assert.ok(Math.abs(script.estimatedSeconds - targetDurationSeconds) <= Math.max(4, Math.round(targetDurationSeconds * 0.2)));

  const { renderScriptEditor } = await import("../../frontend/pages/script-editor.mjs");
  const html = renderScriptEditor({
    id: projectId,
    topic: process.env.LIVE_SCRIPT_TOPIC,
    language: targetLanguage,
    duration: targetDurationSeconds,
    error: null,
    generatedScript: script,
  });
  assert.ok(html.includes(script.title));
  assert.ok(!html.includes("CreatorPilot's Scriptwriter Agent"));

  console.log({
    analysisId: analysis.analysisId,
    scriptId: script.scriptId,
    sections: script.sections.length,
    estimatedSeconds: script.estimatedSeconds,
    scriptScreenRendered: true,
  });
})().catch((error) => {
  console.error("Live Scriptwriter test failed:", error.code || error.name || "ERROR", error.message);
  if (Array.isArray(error.details)) console.error("Validation details:", JSON.stringify(error.details));
  process.exitCode = 1;
});
