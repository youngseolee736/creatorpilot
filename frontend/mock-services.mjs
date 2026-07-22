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

export async function extractTranscript(project, reference = project.references?.[0]) {
  await wait(420);
  maybeFail("extractTranscript");
  return {
    transcriptId: `tr_mock_${project.id}_${reference?.referenceId || "reference-1"}`,
    source: "mock",
    title: reference?.title && !/^Reference \d+$/.test(reference.title) ? reference.title : `Story reference ${reference?.position || 1}`,
    text: referenceTranscript,
    language: project.language,
    wordCount: 92,
    estimatedDuration: 58,
    segments: [],
  };
}

export async function analyzeReference(project = {}, reference = project.references?.[0]) {
  await wait(520);
  maybeFail("analyzeReference");
  const topic = project.topic || "your topic";
  const result = {
    analysisId: `analysis_${project.id || "mock"}_${reference?.referenceId || "reference-1"}`,
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
    appliedExamples: {
      opening: `Challenge the obvious answer behind “${topic}” and promise to test it.`,
      build: `Examine “${topic}” through increasingly consequential evidence without revealing the answer too early.`,
      payoff: `Return to “${topic}” and explain which evidence ultimately changes the answer.`,
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
  if (project.language !== "Korean") return result;
  return {
    ...result,
    summary: "예상을 뒤집는 도입으로 시작해 근거를 쌓고 미래의 의미로 결론을 맺습니다.",
    hookType: "예상을 뒤집는 주장",
    hookPurpose: "익숙한 답을 흔들어 궁금증을 만듭니다.",
    tone: "긴박하고 명확하며 낙관적",
    pacing: "빠른 도입, 차분한 근거, 단호한 결론",
    callToAction: "시청자가 당연한 답을 다시 생각하게 합니다.",
    reusablePatterns: ["익숙한 예상을 뒤집는 문장으로 시작하세요.", "근거의 중요도를 단계적으로 키우세요.", "처음 제기한 질문에 직접 답하며 끝내세요."],
    doNotCopy: ["원본 영상의 고유 사례", "특징적인 비유", "원본 문장 배열"],
    hookMechanics: { ...result.hookMechanics, trigger: "예상 뒤집기", curiosityGap: "당연한 답이 틀렸다면 무엇이 진짜 답인지 궁금하게 만듭니다.", promisedPayoff: "숨겨진 원리와 그것이 전체 판을 바꾸는 이유를 보여줍니다.", deliveryPattern: "기본 답을 흔들고 의미를 잠시 숨긴 뒤 단계적으로 확장합니다.", evidence: "도입부가 익숙한 해결책을 부정한 뒤 대안을 설명합니다." },
    narrativeStyle: { ...result.narrativeStyle, primaryMode: "관점 전환형 설명", narrativeEngine: "작은 단서가 더 큰 가능성으로 확장되고 현실적 긴장이 결론을 늦춥니다.", progression: ["익숙한 답", "숨겨진 대안", "작동 원리", "더 큰 의미", "현실적 긴장"] },
    informationFlow: { ...result.informationFlow, pattern: "통념 → 대안 → 원리 → 확장 → 반론 → 의미", explanation: "하나의 구체적 원리를 이해시킨 뒤 더 큰 의미를 공개합니다.", sequence: ["통념", "대안", "작동 방식", "확장", "한계", "결론"] },
    appliedExamples: { opening: `“${topic}”에 대한 당연한 답을 먼저 뒤집고 검증을 약속하세요.`, build: `“${topic}”의 근거를 중요한 순서로 키우며 답을 너무 빨리 공개하지 마세요.`, payoff: `마지막에 어떤 근거가 “${topic}”의 답을 바꾸는지 분명히 밝히세요.` },
    structure: result.structure.map((section, index) => ({ ...section, note: ["예상한 답을 뒤집어 궁금증을 만듭니다.", "숨겨진 대안을 소개합니다.", "핵심 원리가 어떻게 작동하는지 설명합니다.", "한 사례를 더 큰 의미로 확장합니다.", "한계와 위험을 인정합니다.", "도입의 질문에 답하며 마무리합니다."][index] })),
  };
}

export async function synthesizeReferences(project = {}) {
  await wait(360);
  maybeFail("synthesizeReferences");
  const analyses = (project.references || []).map((reference) => reference.analysis).filter(Boolean);
  const base = analyses[0] || await analyzeReference(project);
  const synthesis = {
    ...base,
    analysisId: `synthesis_${project.id || "mock"}`,
    referenceCount: analyses.length,
    sourceAnalysisIds: analyses.map((analysis) => analysis.analysisId),
    summary: project.language === "Korean" ? `${analyses.length}개 영상은 관점 전환, 단계적 근거, 명확한 결론이라는 공통 흐름을 사용합니다.` : `${analyses.length} references converge on a sharp reframe, progressive proof, and a decisive payoff.`,
    estimatedOriginalDuration: Number(project.duration) || 60,
    synthesis: {
      sharedPatterns: project.language === "Korean" ? ["명확한 예상 뒤집기로 시작하기", "근거를 단계적으로 강화하기", "처음의 비교에 직접 답하기"] : ["Open with a clear expectation reversal", "Build evidence in escalating steps", "Resolve the original comparison directly"],
      distinctStrengths: analyses.slice(0, 3).map((analysis) => analysis.hookType),
    },
  };
  if (project.analysisDepth !== "deep") return synthesis;
  return {
    ...synthesis,
    ensemble: {
      mode: "deep",
      candidates: [
        { id: "candidate-a", focus: "Hook and retention", summary: project.language === "Korean" ? "도입의 긴장과 호기심을 더 빠르게 만드는 안입니다." : "Prioritizes immediate tension and a stronger curiosity gap." },
        { id: "candidate-b", focus: "Flow and clarity", summary: project.language === "Korean" ? "근거가 자연스럽게 이어지고 결론이 명확해지는 안입니다." : "Prioritizes a clean evidence build and an unmistakable payoff." },
      ],
      judgment: {
        winner: "hybrid",
        reason: project.language === "Korean" ? "A의 강한 도입과 B의 명확한 전개를 결합했습니다." : "Combined Candidate A's stronger opening with Candidate B's clearer evidence flow.",
        confidence: 0.9,
      },
      degraded: false,
    },
  };
}

export async function researchTopic(project = {}) {
  await wait(620);
  maybeFail("researchTopic");
  const result = {
    researchId: `research_mock_${project.id}`,
    summary: `The available evidence supports parts of “${project.topic},” but the strongest conclusion depends on the comparison criteria.`,
    verdict: { status: "partially_supported", headline: "The claim is strongest when impact and efficiency are evaluated together.", explanation: "Some measures support the premise while other measures favor established league leaders." },
    narrativeCase: { mode: "reframe", recommendedFrame: "Define greatness by transformative impact, not one statistical leaderboard.", definition: "Greatest means the player whose performance, role, and presence most change the team and the league around him.", thesis: `${project.topic} is defensible when greatness is measured by transformative impact rather than one raw total.`, whyItProvesClaim: "This transparent lens combines the strongest sourced performance evidence with broader team and league influence.", concession: "The named rival still leads important conventional measures.", supportFactIds: ["fact_1", "fact_2", "fact_3"] },
    criteria: ["Total production", "Per-90 efficiency", "Team impact"],
    comparisonSet: ["Primary subject", "Named rival", "League leaders"],
    comparisons: [
      { metric: "Per-90 contribution", subject: "Primary subject", subjectValue: "Competitive", benchmark: "Named rival", benchmarkValue: "Competitive", interpretation: "Rate statistics make unequal playing time easier to compare.", sourceIds: ["source_1"], sourceUrls: ["https://www.mlssoccer.com/stats/players/" ] },
    ],
    facts: [
      { factId: "fact_1", narrativeRole: "opening", claim: "The headline comparison changes when totals are separated from per-90 production.", explanation: "This creates a fairer opening question when players have different minutes.", confidence: "high", sourceIds: ["source_1"], sourceUrls: ["https://www.mlssoccer.com/stats/players/"], usableInScript: true },
      { factId: "fact_2", narrativeRole: "build", claim: "Role and penalty responsibility can materially change an attacking comparison.", explanation: "The build should distinguish raw output from how that output was produced.", confidence: "medium", sourceIds: ["source_2"], sourceUrls: ["https://fbref.com/en/comps/22/Major-League-Soccer-Stats"], usableInScript: true },
      { factId: "fact_3", narrativeRole: "payoff", claim: "A qualified verdict is more defensible than one universal player ranking.", explanation: "The ending should name the criteria on which the subject leads and where the rival remains stronger.", confidence: "high", sourceIds: ["source_3"], sourceUrls: ["https://www.mlssoccer.com/"], usableInScript: true },
    ],
    counterpoint: { claim: "The named rival may still lead important creative measures.", explanation: "A fair conclusion must show where the premise becomes weaker.", sourceIds: ["source_2"], sourceUrls: ["https://fbref.com/en/comps/22/Major-League-Soccer-Stats"] },
    storyFindings: [
      { role: "opening", guidance: "Open with the statistic that most clearly challenges the expected ranking.", factIds: ["fact_1"] },
      { role: "build", guidance: "Compare totals, rate statistics, and role context before naming a leader.", factIds: ["fact_1", "fact_2"] },
      { role: "payoff", guidance: "Resolve with the precise criteria the evidence actually supports.", factIds: ["fact_3"] },
    ],
    sources: [
      { sourceId: "source_1", title: "MLS player statistics", url: "https://www.mlssoccer.com/stats/players/", domain: "mlssoccer.com" },
      { sourceId: "source_2", title: "Major League Soccer statistics", url: "https://fbref.com/en/comps/22/Major-League-Soccer-Stats", domain: "fbref.com" },
      { sourceId: "source_3", title: "Major League Soccer", url: "https://www.mlssoccer.com/", domain: "mlssoccer.com" },
    ],
    openQuestions: ["Which time-sensitive figures should be rechecked immediately before publication?"],
    searchedAt: new Date().toISOString(),
    safety: { providerVerifiedSources: true, factualGuarantee: false },
  };
  if (project.analysisDepth === "deep") {
    result.ensemble = {
      mode: "deep",
      candidates: [
        { id: "candidate-a", focus: "Direct evidence", summary: project.language === "Korean" ? "통계와 직접 비교를 중심으로 주장을 검증했습니다." : "Tests the claim through primary data and fair direct comparisons." },
        { id: "candidate-b", focus: "Narrative case", summary: project.language === "Korean" ? "주장을 정직하게 살릴 수 있는 더 강한 관점을 찾았습니다." : "Finds the strongest truthful lens that can carry the requested claim." },
      ],
      judgment: { winner: "hybrid", reason: project.language === "Korean" ? "직접 비교 근거와 가장 강한 서사적 논리를 검증해 결합했습니다." : "Combined the strongest verified direct evidence with the strongest truthful narrative case.", confidence: 0.9 },
      degraded: false,
    };
  }
  if (project.language !== "Korean") return result;
  return {
    ...result,
    summary: `현재 근거는 “${project.topic}”의 일부를 지지하지만 결론은 비교 기준에 따라 달라집니다.`,
    verdict: { ...result.verdict, headline: "영향력과 효율성을 함께 볼 때 주장이 가장 강해집니다.", explanation: "일부 지표는 주장을 지지하지만 다른 지표에서는 기존 선두 선수가 앞섭니다." },
    narrativeCase: { ...result.narrativeCase, recommendedFrame: "하나의 기록보다 판을 바꾸는 영향력으로 위대함을 정의합니다.", definition: "최고란 경기력과 역할, 존재감으로 팀과 리그를 가장 크게 바꾼 선수입니다.", thesis: `${project.topic}은 단순 누적 기록보다 변화의 영향력으로 평가할 때 설득력이 있습니다.`, whyItProvesClaim: "검증된 경기 근거와 팀·리그에 미친 더 큰 영향을 투명하게 결합합니다.", concession: "주요 경쟁자는 여전히 중요한 전통 지표에서 앞섭니다." },
    criteria: ["전체 생산성", "90분당 효율", "팀에 미친 영향"],
    comparisonSet: ["주요 대상", "지목된 경쟁자", "리그 선두권"],
    comparisons: result.comparisons.map((item) => ({ ...item, metric: "90분당 기여", subject: "주요 대상", benchmark: "지목된 경쟁자", interpretation: "출전 시간이 다를 때는 90분당 지표가 더 공정한 비교를 돕습니다." })),
    facts: result.facts.map((fact, index) => ({ ...fact, claim: ["누적 기록과 90분당 생산성을 분리하면 비교 결과가 달라집니다.", "역할과 페널티킥 비중은 공격수 비교에 큰 영향을 줍니다.", "모든 기준을 하나로 합친 순위보다 조건을 밝힌 결론이 더 설득력 있습니다."][index], explanation: ["출전 시간이 다른 선수에게 더 공정한 출발점을 만듭니다.", "결과뿐 아니라 그 결과가 만들어진 방식을 구분해야 합니다.", "결론은 대상이 앞서는 기준과 경쟁자가 앞서는 기준을 함께 밝혀야 합니다."][index] })),
    counterpoint: { ...result.counterpoint, claim: "지목된 경쟁자는 중요한 창의성 지표에서 여전히 앞설 수 있습니다.", explanation: "공정한 결론은 주장이 약해지는 지점도 보여줘야 합니다." },
    storyFindings: result.storyFindings.map((finding, index) => ({ ...finding, guidance: ["예상 순위를 가장 명확히 흔드는 수치로 시작하세요.", "우승자를 정하기 전에 누적 기록, 비율 지표, 역할을 비교하세요.", "근거가 실제로 지지하는 정확한 기준으로 결론을 맺으세요."][index] })),
    openQuestions: ["게시 직전에 다시 확인해야 할 시의성 높은 수치는 무엇인가요?"],
  };
}

export async function generateScript(project) {
  await wait(560);
  maybeFail("generateScript");
  const caseMode = project.research?.narrativeCase?.mode || "reframe";
  const mode = caseMode === "direct" ? "direct_case" : caseMode === "reframe" ? "reframed_case" : "evidence_boundary";
  const withEnsemble = (script) => project.analysisDepth !== "deep" ? script : ({
    ...script,
    ensemble: {
      mode: "deep",
      candidates: [
        { id: "candidate-a", focus: "Story and retention", summary: project.language === "Korean" ? "더 강한 도입과 긴장감 있는 전개를 만든 초안입니다." : "Builds a stronger opening and more engaging story momentum." },
        { id: "candidate-b", focus: "Evidence and clarity", summary: project.language === "Korean" ? "근거와 반론이 더 명확하게 이어지는 초안입니다." : "Makes the evidence, counterpoint, and conclusion easier to follow." },
      ],
      judgment: { winner: "hybrid", reason: project.language === "Korean" ? "A의 강한 이야기 흐름과 B의 명확한 근거 전개를 결합했습니다." : "Combined Candidate A's stronger story momentum with Candidate B's clearer evidence flow.", confidence: 0.9 },
      degraded: false,
    },
  });
  if (project.language === "Korean") {
    return withEnsemble({
      scriptId: `script_mock_${project.id}_${(project.generatedScript?.version || 0) + 1}`,
      claim: project.topic,
      claimStrategy: { mode, researchStatus: project.research?.verdict?.status || "partially_supported", frame: project.research?.narrativeCase?.recommendedFrame, explanation: "가장 강한 근거와 투명한 기준으로 사용자의 주장을 설득합니다." },
      usedFactIds: ["fact_1", "fact_2", "fact_3"],
      title: project.topic,
      version: (project.generatedScript?.version || 0) + 1,
      estimatedSeconds: 60,
      sections: [
        { id: "hook", label: "Hook", range: "0–5s", text: `${project.topic}. 말도 안 된다고요? 우리가 ‘최고’의 기준부터 제대로 정하면 이야기가 달라집니다.`, factIds: ["fact_1"] },
        { id: "context", label: "Context", range: "5–15s", text: "공정한 비교는 이름값이 아니라 현재 영향력, 효율, 출전 시간, 그리고 팀에서 맡은 역할을 함께 봐야 합니다.", factIds: ["fact_1"] },
        { id: "argument-1", label: "Main argument 1", range: "15–27s", text: "누적 기록만 보면 익숙한 답이 나오지만, 90분당 생산성과 실제 경기 기여를 분리하면 격차의 의미가 달라집니다.", factIds: ["fact_2"] },
        { id: "argument-2", label: "Main argument 2", range: "27–40s", text: "물론 경쟁자가 앞서는 중요한 지표도 있습니다. 그 사실을 인정해야 이 비교가 억지가 아니라 설득력 있는 주장으로 남습니다.", factIds: ["fact_3"] },
        { id: "argument-3", label: "Main argument 3", range: "40–51s", text: "하지만 최고를 팀과 리그의 기대치를 가장 크게 바꾼 선수로 정의한다면, 단 하나의 기록표만으로 결론낼 수 없습니다.", factIds: ["fact_2"] },
        { id: "conclusion", label: "Conclusion", range: "51–57s", text: "그 기준에서는 사용자의 주장이 충분히 성립합니다. 중요한 건 누가 더 유명한지가 아니라 무엇을 실제로 바꿨는가입니다.", factIds: ["fact_3"] },
        { id: "cta", label: "CTA", range: "57–60s", text: "여러분이 생각하는 ‘최고’의 기준은 무엇인가요?", factIds: [] },
      ],
    });
  }
  return withEnsemble({
    scriptId: `script_mock_${project.id}_${(project.generatedScript?.version || 0) + 1}`,
    claim: project.topic,
    claimStrategy: { mode, researchStatus: project.research?.verdict?.status || "partially_supported", frame: project.research?.narrativeCase?.recommendedFrame, explanation: mode === "direct_case" ? "The script proves the claim with direct evidence." : mode === "evidence_boundary" ? "No honest supporting route was found." : "The script proves the claim through the strongest transparent narrative lens." },
    usedFactIds: ["fact_1", "fact_2", "fact_3"],
    title: project.topic,
    version: (project.generatedScript?.version || 0) + 1,
    estimatedSeconds: 60,
    sections: [
      { id: "hook", label: "Hook", range: "0–5s", text: `${project.topic} sounds surprising—until we define what “best” actually means.`, factIds: ["fact_1"] },
      { id: "context", label: "Context", range: "5–15s", text: "The fair comparison uses current impact, efficiency, availability, and team role instead of fame alone.", factIds: ["fact_1"] },
      { id: "argument-1", label: "Main argument 1", range: "15–27s", text: "The strongest evidence supports the claim on the measures that connect most directly to match-winning impact.", factIds: ["fact_2"] },
      { id: "argument-2", label: "Main argument 2", range: "27–40s", text: "The rival still leads an important category, and acknowledging that counterpoint makes the comparison more credible.", factIds: ["fact_3"] },
      { id: "argument-3", label: "Main argument 3", range: "40–51s", text: "But one leading category does not settle the whole question when the chosen criteria measure a broader contribution.", factIds: ["fact_2"] },
      { id: "conclusion", label: "Conclusion", range: "51–57s", text: `Under those explicit criteria, the evidence makes ${project.topic.toLowerCase()} a defensible conclusion.`, factIds: ["fact_3"] },
      { id: "cta", label: "CTA", range: "57–60s", text: "Now decide which measure of best matters most to you.", factIds: [] },
    ],
  });
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
  const result = {
    status: "passed",
    overall: 91,
    scores: { hook: 88, structure: 84, clarity: 94, duration: 98 },
    summary: "The draft uses the reference's pacing discipline without repeating its language or subject-specific examples.",
    overlaps: [
      {
        reference: "The real breakthrough is not a single floating building.",
        generated: "Putting things off is not a character flaw; it is your brain dodging a feeling.",
        risk: "Low",
        note: "Shared contrast construction, but different wording, meaning, and placement.",
      },
      {
        reference: "The cities that prepare now may not have to retreat later.",
        generated: "Starting small feels pointless today, but it is exactly what makes tomorrow's work easier.",
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
  if (project.language !== "Korean") return result;
  return {
    ...result,
    summary: "초안은 참고 영상의 속도감만 활용하고 표현과 주제별 사례는 새롭게 구성했습니다.",
    overlaps: result.overlaps.map((overlap, index) => ({ ...overlap, note: ["대조 구조는 비슷하지만 단어와 의미, 위치가 모두 다릅니다.", "미래의 결과로 끝나는 공통점이 있지만 문장 흐름과 주제는 구별됩니다."][index] })),
    instructions: ["근거의 순서는 유지하되 참고 영상의 고유 사례는 사용하지 마세요.", "새 주제의 질문에 직접 답하는 마지막 문장은 유지하세요."],
  };
}

export async function generateStoryboard(project) {
  await wait(540);
  maybeFail("generateStoryboard");
  const sections = project.generatedScript?.sections || Array.from({ length: 8 }, (_, index) => ({
    text: `Scene ${index + 1} narration for ${project.topic}.`,
  }));
  const scenes = [
    [0, 5, "Animated alarm clock with phone notifications piling up", "You know you should start", "alarm clock phone notifications morning"],
    [5, 12, "Presenter at a desk glancing at a growing to-do list", "It's not about being lazy", "presenter desk to-do list studio"],
    [12, 19, "Brain illustration with emotion and logic regions lighting up", "Your brain avoids feelings", "brain regions animation illustration"],
    [19, 27, "Person cleaning the entire kitchen instead of working", "Suddenly everything else is urgent", "person cleaning kitchen procrastination"],
    [27, 35, "A guilt spiral visualized as looping arrows", "Avoid, guilt, repeat", "circular arrows loop animation"],
    [35, 43, "Timer set to five minutes beside an open notebook", "Start smaller than you think", "timer five minutes notebook desk"],
    [43, 51, "Checkmarks appearing on a simple habit tracker", "Tiny wins rewire the habit", "habit tracker checkmarks close up"],
    [51, 60, "Presenter relaxed, finishing work as the sun sets", "Starting is the whole trick", "relaxed person finishing work sunset"],
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
