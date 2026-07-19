const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { Scriptwriter } = require("../src/agents/scriptwriter/scriptwriter");
const { createApp } = require("../src/app");

const transcriptText = "The reference begins with a surprising question, introduces familiar context, compares several approaches, raises practical stakes, and resolves the opening idea near the ending. The presentation uses concise transitions and a final invitation for viewers to reflect on the topic.";

const provider = {
  async complete() {
    return JSON.stringify({
      summary: "A long-form news explainer that opens with an urgent escalation claim, includes an early engagement prompt, presents a sequence of concrete incidents and a surprising strategic revelation, then analyzes cascading economic and military implications before closing with uncertain multi-front stakes.",
      hookType: "Urgent escalation statement paired with a surprising operational revelation",
      hookDuration: 4,
      hookPurpose: "Grab immediate attention by conveying that a local conflict is intensifying and hinting at a consequential development that raises stakes for global stakeholders.",
      targetAudience: "People interested in international security and geopolitics, maritime logistics, professional defense and policy watchers, informed general public worried about supply-chain and regional stability.",
      tone: "urgent,informative,analytical,cautionary,authoritative",
      contentPromise: "Compare several approaches and resolve the opening question.",
      pacing: "Rapid attention-grabbing opening, quick engagement prompt, steady evidence sequence, deliberate operational reveal, dense analysis, and an unresolved multi-scenario close",
      retentionTechniques: ["Lead with a high-stakes claim to create immediate urgency", "Delay the operational revelation until context has raised its significance"],
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

const fixtureNarration = [
  "One narrow corridor can influence decisions made across an entire ocean, because the question is larger than any single border or headline.",
  "Taiwan sits inside a network of shipping routes, advanced manufacturing, regional partnerships, and security commitments that reaches far beyond the island itself.",
  "Walking away could appear to reduce one immediate risk, yet it would also force every nearby partner to reconsider which long-term promises remain dependable.",
  "That uncertainty would travel through supply chains and diplomatic relationships together, making future crises harder to contain before they become wider confrontations.",
  "The strongest policy is therefore not a dramatic gesture but steady coordination: clearer expectations, resilient trade, and choices that leave room for peaceful outcomes.",
  "The map looks narrow, but the consequences are global. Follow for more concise explanations of the systems shaping tomorrow's most important decisions.",
];
const scriptProvider = {
  async complete(messages) {
    const payload = JSON.parse(messages[1].content.slice(messages[1].content.indexOf("{") ));
    return JSON.stringify({
      title: payload.topic,
      sections: payload.sectionPlan.map((section, sectionIndex) => ({
        slot: section.slot,
        label: section.label,
        text: fixtureNarration[sectionIndex] || fixtureNarration[fixtureNarration.length - 1],
      })),
    });
  },
};

const app = createApp({
  transcriptService,
  scriptAnalyst: new ScriptAnalyst({ provider }),
  scriptwriter: new Scriptwriter({ provider: scriptProvider }),
});
const server = app.listen(8787, "127.0.0.1", () => {
  console.log("CreatorPilot Phase 3 browser fixture listening on http://127.0.0.1:8787");
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
