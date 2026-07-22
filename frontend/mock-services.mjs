const referenceTranscript = `Most people think the future of coastal cities is higher sea walls. But a quieter experiment is already moving neighborhoods onto the water. Engineers are testing modular platforms that rise with tides, connect to existing infrastructure, and can be reconfigured as communities change. The real breakthrough is not a single floating building. It is treating land as something a city can add over time. There are difficult questions about cost, storms, access, and public ownership. Still, the first pilot districts suggest a new option for places running out of safe ground. The cities that prepare now may not have to retreat later.`;

function delayFor(base = 360) {
  const fast = globalThis.location?.search?.includes("fast=1");
  return fast ? 12 : base;
}

async function wait(ms = 360) {
  await new Promise((resolve) => setTimeout(resolve, delayFor(ms)));
}

function maybeFail(serviceName) {
  const params = new URLSearchParams(globalThis.location?.search || "");
  if (params.get("fail") === serviceName) {
    const error = new Error(`${serviceName} could not complete. Your project is still saved.`);
    error.code = "MOCK_SERVICE_ERROR";
    throw error;
  }
}

export async function extractTranscript(project) {
  await wait(420);
  maybeFail("extractTranscript");
  return {
    transcriptId: `tr_mock_${project.id}`,
    source: "mock",
    title: project.referenceTitle === "Reference video" ? "How coastal cities could move onto the water" : project.referenceTitle,
    text: referenceTranscript,
    language: project.language,
    wordCount: 92,
    estimatedDuration: 58,
    segments: [],
  };
}

export async function analyzeReference(project = {}) {
  await wait(520);
  maybeFail("analyzeReference");
  return {
    analysisId: `analysis_${project.id || "mock"}`,
    summary: "A concise explainer that opens with a reframe, develops the mechanism, and resolves with future stakes.",
    hookType: "Counter-intuitive claim",
    hookDuration: 5,
    hookPurpose: "Challenge the expected solution and create curiosity.",
    targetAudience: "Curious general audience interested in cities and technology",
    tone: "Urgent, informed, optimistic",
    contentPromise: "Explain how an overlooked approach could change a familiar problem.",
    pacing: "Fast opening, measured evidence, decisive close",
    retentionTechniques: ["Expectation reversal", "Concrete visual examples", "Open-loop question", "Future-facing payoff"],
    openLoops: ["Delay the full implications of the opening reframe until the conclusion."],
    transitions: ["Move from a familiar assumption to mechanism, tension, and resolution."],
    callToAction: "Invite the viewer to reconsider the obvious solution",
    reusablePatterns: ["Open with an expectation reversal", "Escalate from one example to system-level stakes"],
    doNotCopy: ["Reference-specific examples", "Distinctive analogies", "Original sentence sequences"],
    confidence: 0.92,
    estimatedOriginalDuration: 58,
    hookMechanics: {
      trigger: "Expectation reversal",
      curiosityGap: "If the obvious solution is incomplete, what alternative could work?",
      promisedPayoff: "Reveal the overlooked mechanism and why it changes the larger system.",
      deliveryPattern: "Challenge the default answer, withhold the larger implication, then expand it in stages.",
      evidenceStart: 0,
      evidenceEnd: 5,
      evidence: "The opening rejects the expected solution before explaining the alternative.",
    },
    narrativeStyle: {
      primaryMode: "Reframe-driven explainer",
      narrativeEngine: "A small experiment expands into a system-level possibility while practical risks keep the outcome uncertain.",
      progression: ["Expected answer", "Hidden alternative", "Working mechanism", "System reframe", "Practical tension", "Future payoff"],
    },
    informationFlow: {
      pattern: "Assumption → alternative → mechanism → scale → objections → implication",
      explanation: "The explanation delays broad stakes until the viewer understands one concrete mechanism.",
      sequence: ["Familiar assumption", "Contrasting possibility", "How it works", "Why it scales", "What could fail", "Why it matters"],
    },
    retentionMap: [
      { type: "Expectation reversal", start: 0, end: 5, purpose: "Interrupt the default answer and create a knowledge gap.", evidence: "The opening replaces the familiar solution with an unexplained alternative." },
      { type: "Progressive reveal", start: 14, end: 39, purpose: "Increase the significance of the idea in two stages.", evidence: "A specific mechanism is explained before its system-level implication." },
      { type: "Tension reset", start: 39, end: 51, purpose: "Prevent an easy conclusion by introducing constraints.", evidence: "Practical risks appear immediately before the final payoff." },
    ],
    emotionalArc: [
      { phase: "Surprise", start: 0, end: 14, purpose: "Move the viewer away from the expected answer." },
      { phase: "Discovery", start: 14, end: 39, purpose: "Reward curiosity with an understandable mechanism and larger implication." },
      { phase: "Concern", start: 39, end: 51, purpose: "Keep the outcome credible by acknowledging unresolved constraints." },
      { phase: "Possibility", start: 51, end: 58, purpose: "Resolve the opening with a cautious future-facing payoff." },
    ],
    viewerExperience: {
      entryState: "The viewer expects a familiar solution to a familiar problem.",
      journey: "Surprise becomes understanding, then cautious concern as the idea scales.",
      exitState: "The viewer leaves with a broader mental model and a plausible alternative worth considering.",
    },
    structure: [
      { label: "Hook", start: 0, end: 5, note: "Contradicts the expected solution" },
      { label: "Context", start: 5, end: 14, note: "Introduces the hidden experiment" },
      { label: "Mechanism", start: 14, end: 27, note: "Explains how the idea works" },
      { label: "Reframe", start: 27, end: 39, note: "Expands one building into a city system" },
      { label: "Tension", start: 39, end: 51, note: "Acknowledges cost and risk" },
      { label: "Conclusion", start: 51, end: 58, note: "Returns to the future stakes" },
    ],
    safety: { longSourceExcerptsIncluded: false, maxQuotedWords: 0 },
  };
}

export async function researchTopic(project = {}) {
  await wait(620);
  maybeFail("researchTopic");
  return {
    researchId: `research_mock_${project.id}`,
    summary: `A compact evidence pack tailored to ${project.creativeBrief?.targetAudience || "the selected audience"} and the angle “${project.creativeBrief?.angle || project.topic}.”`,
    facts: [
      { factId: "fact_1", claim: "The topic affects systems beyond the most visible headline.", explanation: "The strongest framing connects the immediate event to infrastructure, institutions, and downstream consequences.", confidence: "high", sourceIds: ["source_1"], sourceUrls: ["https://www.oecd.org/"], usableInScript: true },
      { factId: "fact_2", claim: "Audience understanding improves when the mechanism is explained before the stakes.", explanation: "The narration should establish how the system works, then show what changes if one part fails.", confidence: "medium", sourceIds: ["source_2"], sourceUrls: ["https://ourworldindata.org/"], usableInScript: true },
      { factId: "fact_3", claim: "Recent primary sources should anchor any precise or time-sensitive claim.", explanation: "Dates, quantities, and policy positions can change, so the final editor should open the linked source before publishing.", confidence: "high", sourceIds: ["source_3"], sourceUrls: ["https://www.un.org/en/"], usableInScript: true },
    ],
    sources: [
      { sourceId: "source_1", title: "OECD", url: "https://www.oecd.org/", domain: "oecd.org" },
      { sourceId: "source_2", title: "Our World in Data", url: "https://ourworldindata.org/", domain: "ourworldindata.org" },
      { sourceId: "source_3", title: "United Nations", url: "https://www.un.org/en/", domain: "un.org" },
    ],
    openQuestions: ["Which time-sensitive figures should be rechecked immediately before publication?"],
    searchedAt: new Date().toISOString(),
    safety: { providerVerifiedSources: true, factualGuarantee: false },
  };
}

export async function generateScript(project) {
  await wait(560);
  maybeFail("generateScript");
  return {
    scriptId: `script_mock_${project.id}_${(project.generatedScript?.version || 0) + 1}`,
    title: project.topic,
    version: (project.generatedScript?.version || 0) + 1,
    estimatedSeconds: 59,
    sections: [
      { id: "hook", label: "Hook", range: "0–5s", text: "The most important line on a map may be the one ships cannot cross." },
      { id: "context", label: "Context", range: "5–15s", text: `That is why ${project.topic.toLowerCase()} is less about one headline and more about the system hidden underneath it.` },
      { id: "argument-1", label: "Main argument 1", range: "15–27s", text: "Trade routes, advanced manufacturing, and regional security all converge in the same narrow corridor." },
      { id: "argument-2", label: "Main argument 2", range: "27–40s", text: "If that corridor becomes unreliable, the shock does not stay local. It reaches factories, prices, and alliances around the world." },
      { id: "argument-3", label: "Main argument 3", range: "40–51s", text: "Support is therefore not only a promise to one partner. It is a signal that long-term agreements still mean something." },
      { id: "conclusion", label: "Conclusion", range: "51–57s", text: "Walking away might look simpler today, but it would make every future crisis harder." },
      { id: "cta", label: "CTA", range: "57–60s", text: "Follow for one-minute explanations of the forces shaping tomorrow." },
    ],
  };
}

export async function reviseScript(project, revisionInstructions = []) {
  const currentScript = project.generatedScript;
  const revised = await generateScript(project);
  return {
    ...revised,
    supersedesScriptId: currentScript?.scriptId,
    sections: revised.sections.map((section, index) => ({
      ...section,
      id: currentScript?.sections?.[index]?.id || section.id,
      text: revisionInstructions.length && index === revised.sections.length - 2
        ? `${section.text} This version also incorporates the requested editorial direction.`
        : section.text,
    })),
  };
}

export async function reviewOriginality(project) {
  await wait(500);
  maybeFail("reviewOriginality");
  return {
    status: "passed",
    overall: 91,
    scores: { hook: 88, structure: 84, clarity: 94, duration: 98 },
    summary: "The draft uses the reference's pacing discipline without repeating its language or subject-specific examples.",
    overlaps: [
      {
        reference: "The real breakthrough is not a single floating building.",
        generated: "Support is therefore not only a promise to one partner.",
        risk: "Low",
        note: "Shared contrast construction, but different wording, meaning, and placement.",
      },
      {
        reference: "The cities that prepare now may not have to retreat later.",
        generated: "Walking away might look simpler today, but it would make every future crisis harder.",
        risk: "Low",
        note: "Both close on future consequences; revise only if a more distinct cadence is desired.",
      },
    ],
    instructions: [
      "Keep the evidence sequence, but avoid adding any distinctive examples from the reference.",
      "Retain the final sentence because it resolves the new topic rather than the source story.",
    ],
    disclaimer: "This similarity review is an originality estimate, not a copyright or legal determination.",
  };
}

export async function generateStoryboard(project) {
  await wait(540);
  maybeFail("generateStoryboard");
  const sections = project.generatedScript?.sections || Array.from({ length: 8 }, (_, index) => ({
    text: `Scene ${index + 1} narration for ${project.topic}.`,
  }));
  const scenes = [
    [0, 5, "Animated maritime map with a narrow passage highlighted", "The line ships cannot cross", "map ocean shipping corridor aerial"],
    [5, 12, "Presenter silhouette facing a layered regional map", "More than one headline", "presenter geopolitical map studio"],
    [12, 19, "Container ships moving through a busy port", "Trade routes converge here", "container port aerial vertical"],
    [19, 27, "Close-up montage of advanced semiconductor production", "Manufacturing at global scale", "semiconductor factory clean room"],
    [27, 35, "Supply chain nodes illuminate across a world map", "A local shock travels", "global supply chain network animation"],
    [35, 43, "Factory lines pause as shipping indicators turn amber", "Factories · prices · alliances", "factory supply disruption cinematic"],
    [43, 51, "Diplomatic handshake and joint exercise archival-style montage", "Long-term agreements matter", "alliance diplomacy handshake security"],
    [51, 60, "Map pulls back as multiple routes remain connected", "Today's choice shapes tomorrow", "connected world routes hopeful ending"],
  ];
  return scenes.map(([start, end, visual, caption, query], index) => ({
    id: `scene-${index + 1}`,
    number: index + 1,
    start,
    end,
    duration: end - start,
    narration: sections[Math.min(index, sections.length - 1)].text,
    caption,
    visual,
    searchQuery: query,
    transition: index === 0 ? "Fade up" : index === scenes.length - 1 ? "Fade out" : "Match cut",
  }));
}

export async function renderVideo(project, onProgress = () => {}) {
  maybeFail("renderVideo");
  const stages = [
    ["Planning scenes", 10],
    ["Finding B-roll", 28],
    ["Generating narration", 48],
    ["Creating captions", 66],
    ["Combining scenes", 84],
    ["Rendering final video", 96],
  ];
  for (const [stage, progress] of stages) {
    await wait(300);
    maybeFail("renderVideo");
    onProgress({ stage, progress });
  }
  await wait(240);
  return {
    stage: "Final video ready",
    progress: 100,
    completed: true,
    format: project.format,
    duration: project.duration,
    voice: project.productionSettings.voice,
    captionStyle: project.productionSettings.captions,
    music: project.productionSettings.music,
    completedAt: new Date().toISOString(),
  };
}
