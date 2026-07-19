const { ScriptAnalyst } = require("../src/agents/script-analyst/script-analyst");
const { OriginalityReviewer } = require("../src/agents/originality-reviewer/originality-reviewer");
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

const reviewerProvider = {
  async complete() {
    return JSON.stringify({
      originalityEstimate: 92,
      structureSimilarity: {
        score: 32,
        note: "The draft shares only an abstract escalation-and-resolution arc with the reference.",
      },
      scores: { hook: 90, structure: 87, clarity: 94, duration: 96 },
      summary: "The draft keeps the reference's pacing mechanics while using distinct language and subject-specific expression.",
      overlaps: [{
        reference: "raises practical stakes",
        generated: "making future crises harder to contain",
        risk: "Low",
        note: "Both escalate consequences, but the wording, topic, and narrative placement are distinct.",
      }, {
        reference: "resolves the opening idea near the ending",
        generated: "The map looks narrow, but the consequences are global",
        risk: "Low",
        note: "Both resolve the opening near the close, while the language and conclusion remain topic-specific.",
      }],
      instructions: ["Keep all supporting claims tied to reliable sources before production."],
    });
  },
};

const app = createApp({
  transcriptService,
  scriptAnalyst: new ScriptAnalyst({ provider }),
  scriptwriter: new Scriptwriter({ provider: scriptProvider }),
  originalityReviewer: new OriginalityReviewer({ provider: reviewerProvider }),
});
const port = Number(process.env.PORT || 8787);
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`CreatorPilot Phase 4 browser fixture listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
