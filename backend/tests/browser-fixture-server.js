const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { createApp } = require("../src/app");

const transcriptText = "The reference begins with a surprising question, introduces familiar context, compares several approaches, raises practical stakes, and resolves the opening idea near the ending. The presentation uses concise transitions and a final invitation for viewers to reflect on the topic.";

const provider = {
  async complete() {
    return JSON.stringify({
      summary: "A concise explainer that uses curiosity, escalation, and resolution.",
      hookType: "Provocative question",
      hookDuration: 4,
      hookPurpose: "Create curiosity around a familiar assumption.",
      targetAudience: "General viewers with beginner knowledge of the topic.",
      tone: "Confident, conversational, practical",
      contentPromise: "Compare several approaches and resolve the opening question.",
      pacing: "Fast opening, measured middle, concise resolution",
      retentionTechniques: ["Delayed answer", "Escalating supporting points"],
      openLoops: ["Delay the answer to the opening question until the conclusion."],
      transitions: ["Move from familiar context to increasingly specific consequences."],
      callToAction: "Invite viewers to apply the question to their own context.",
      reusablePatterns: ["Open with a question before context", "Resolve the opening loop near the end"],
      doNotCopy: ["Reference-specific examples", "Distinctive sentence sequences"],
      confidence: 0.88,
      estimatedOriginalDuration: 58,
      structure: [
        { label: "Hook", start: 0, end: 4, note: "Create curiosity with an unresolved question." },
        { label: "Context", start: 4, end: 14, note: "Establish familiar context before analysis." },
        { label: "Comparison", start: 14, end: 28, note: "Compare several approaches." },
        { label: "Escalation", start: 28, end: 41, note: "Raise the practical stakes." },
        { label: "Resolution", start: 41, end: 53, note: "Resolve the opening loop." },
        { label: "CTA", start: 53, end: 58, note: "Invite audience reflection." },
      ],
    });
  },
};

const transcriptService = {
  async extract(context) {
    return {
      transcriptId: `tr_${context.videoId}`,
      source: "youtube_captions",
      title: null,
      text: transcriptText,
      language: "en",
      wordCount: transcriptText.split(/\s+/).length,
      estimatedDuration: 58,
      segments: [
        { start: 0, end: 29, text: "Opening and comparison." },
        { start: 29, end: 58, text: "Escalation and resolution." },
      ],
    };
  },
};

const app = createApp({ transcriptService, scriptAnalyst: new ScriptAnalyst({ provider }) });
const server = app.listen(8787, "127.0.0.1", () => {
  console.log("CreatorPilot Phase 2 browser fixture listening on http://127.0.0.1:8787");
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
