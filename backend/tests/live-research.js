require("dotenv").config();
const assert = require("assert");
const { Researcher } = require("../src/agents/researcher/researcher");
const { hasLLMConfiguration } = require("../src/services/llm");

if (!hasLLMConfiguration("RESEARCH")) {
  console.log("SKIP: Live Research Agent test requires RESEARCH_LLM_* or shared LLM_* settings.");
  process.exit(0);
}

(async () => {
  const result = await new Researcher().research({
    projectId: "project-live-research",
    creativeBrief: {
      topic: process.env.LIVE_RESEARCH_TOPIC || "How public libraries strengthen neighborhoods",
      angle: "Explain a few measurable civic benefits without nostalgia or invented statistics.",
      targetAudience: "General adults interested in local communities",
      viewerGoal: "Understand why libraries matter beyond lending books",
      desiredTakeaway: "Libraries can function as practical civic infrastructure",
      tone: "Clear, practical, evidence-led",
      language: "English",
      mustInclude: [],
      mustAvoid: ["Partisan framing", "Unsupported causal claims"],
      callToAction: "Invite viewers to examine their local library's services",
    },
    referenceBlueprint: {
      analysisId: "analysis_live_research",
      hookType: "Expectation reversal",
      hookPurpose: "Challenge a narrow assumption",
      tone: "Optimistic",
      pacing: "Fast opening, measured evidence, concise close",
      ending: "Resolve with broader community stakes",
      retentionTechniques: ["Expectation reversal", "Concrete mechanism"],
      structure: [
        { label: "Hook", start: 0, end: 5, purpose: "Create curiosity" },
        { label: "Context", start: 5, end: 15, purpose: "Set up the familiar assumption" },
        { label: "Development", start: 15, end: 49, purpose: "Explain the mechanism and evidence" },
        { label: "Conclusion (Ending)", start: 49, end: 60, purpose: "Resolve the promise" },
      ],
    },
  });
  assert.ok(result.facts.length >= 3);
  assert.ok(result.sources.length >= 1);
  assert.ok(result.facts.every((fact) => fact.sourceIds.length && fact.usableInScript));
  assert.equal(result.safety.providerVerifiedSources, true);
  console.log({ researchId: result.researchId, facts: result.facts.length, sources: result.sources.length, providerVerifiedSources: true });
})().catch((error) => {
  console.error("Live Research Agent test failed:", error.code || error.name || "ERROR", error.message);
  if (Array.isArray(error.details)) console.error("Validation details:", JSON.stringify(error.details));
  process.exitCode = 1;
});

