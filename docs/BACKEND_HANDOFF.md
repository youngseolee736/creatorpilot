# CreatorPilot Backend Handoff Map

Status: Phase 7 transcript extraction, Script Analyst, Research Agent, Scriptwriter, Originality
Reviewer, Storyboard, and Video Producer boundaries implemented.

## Runtime boundary

- `frontend/config.js` is public runtime configuration and defaults to `useMockServices: true`.
- `frontend/service-client.mjs` is the only service selector imported by `frontend/app.js`.
- Mock mode delegates to `frontend/mock-services.mjs` unchanged.
- Per-service mode can route every production stage through the Express API or
  retain an individual deterministic mock fallback.
- No API key, provider credential, or private configuration may be added to `config.js` or any browser bundle.
- The browser's local storage key remains `creatorpilot:v1`; project cloud persistence is not yet wired into the store.

Example development configuration:

```js
window.CREATORPILOT_CONFIG = Object.freeze({
  useMockServices: true,
  apiBaseUrl: "",
  renderPollIntervalMs: 1500,
});
```

Example public API-mode configuration (enabled in this repository):

```js
window.CREATORPILOT_CONFIG = Object.freeze({
  services: {
    transcript: "api",
    analysis: "api",
    script: "api",
    review: "api",
    storyboard: "api",
    video: "api",
  },
  apiBaseUrl: "http://127.0.0.1:8787",
  renderPollIntervalMs: 1500,
  renderPollLimit: 240,
});
```

The backend selects `LLM_PROVIDER=openai-compatible`. `LLM_API_BASE_URL`,
`LLM_API_KEY`, and `LLM_MODEL` are required when a real analysis, Scriptwriter,
Reviewer, or Storyboard endpoint is called. `LLM_TIMEOUT_MS` defaults to 30000.
Each Agent first reads its `ANALYST_LLM_*`, `RESEARCH_LLM_*`, `SCRIPTWRITER_LLM_*`,
`REVIEWER_LLM_*`, or `STORYBOARD_LLM_*` override and falls back field-by-field
to the shared `LLM_*` values. These variables are server-only. Video API mode is
deliberately isolated from all LLM settings and requires `RENDER_API_BASE_URL`,
`RENDER_API_KEY`, and optionally `RENDER_TIMEOUT_MS` for the generic adapter.
Set `RENDER_PROVIDER=shotstack` to use `SHOTSTACK_API_URL`,
`SHOTSTACK_API_KEY`, and `SHOTSTACK_TIMEOUT_MS` instead. The Shotstack Stage
adapter currently produces a real watermarked, caption-card MP4 from the
approved timeline without invoking paid AI assets; media and TTS acquisition
remain separate upstream responsibilities.

## Service summary

| Current function | Current file | Future endpoint | UI consumers | Loading state | Required error state | Polling | Cache |
|---|---|---|---|---|---|---|---|
| `extractTranscript(project)` | `frontend/mock-services.mjs` | `POST /api/transcripts/extract` | `app.js#ensureAnalysis`, `pages/analysis.mjs`, shared pipeline | Extracting reference transcript | Inline agent error with Retry; distinguish invalid/private/no transcript from transient provider failure | No | Cache by canonical video ID + caption language; respect transcript retention policy |
| `analyzeReference(project)` | same | `POST /api/analysis/reference` | `app.js#ensureAnalysis`, `pages/analysis.mjs` | Mapping hook, pacing, and structure | Retry for transient model errors; invalid/short transcript requires new source | No | Cache by transcript content hash + analyzer version |
| `researchTopic(project)` | same | `POST /api/research/topic` | `app.js#ensureResearch`, `pages/research.mjs` | Checking current sources for the tailored angle | Retry transient web-search errors; never promote uncited claims | No | Cache by exact brief + blueprint within the running backend |
| `generateScript(project)` | same | `POST /api/scripts/generate` | `app.js#ensureScript`, `pages/script-editor.mjs` | Drafting original narration / Writing a new version | Retry without duplicate versions; show unsupported brief/language separately | No | Do not shared-cache creative output; store immutable result per project/version |
| `reviewOriginality(project)` | same | `POST /api/scripts/review` | `app.js#ensureReview`, `pages/review.mjs` | Comparing language and story structure | Retry; never convert an unavailable review into a pass | No | Cache by reference hash + exact script hash + reviewer version |
| `generateStoryboard(project)` | same | `POST /api/storyboards/generate` | `app.js#ensureStoryboard`, `pages/production.mjs` | Planning scenes and visual evidence | Retry; reject non-passed or stale review | No | Store by approved script/review ID; invalidate when script changes |
| `renderVideo(project, onProgress)` | same | `POST /api/videos/render`, then `GET /api/videos/:renderId/status` | `app.js#startRender`, `pages/production.mjs` | Preparing, staged progress, final result | Retry start/status separately; preserve `renderId`; terminal provider failure must stop polling | Yes, 1.5 s default | Never HTTP-cache live status; persist final render metadata and use signed media URLs |

## Exact mock shapes and replacement notes

### `extractTranscript(project)`

Current input: the full local project. Fields read: `referenceTitle`; the future adapter sends `id`, `referenceUrl`, and `language` as an explicit request.

Current response:

```json
{
  "source": "mock",
  "title": "How coastal cities could move onto the water",
  "text": "Most people think the future of coastal cities is higher sea walls...",
  "wordCount": 92,
  "estimatedDuration": 58
}
```

The UI stores it as `project.transcript`, replaces `project.referenceTitle`, and displays transcript metadata/preview. The API may add `transcriptId`, `language`, and timestamped `segments`; existing fields must remain present. Required failures: invalid URL, inaccessible/private/deleted video, captions unavailable, provider rate limit, timeout, network/server error. Retry keeps the local project and does not clear a successfully stored transcript.

### `analyzeReference(project)`

The mock accepts the project only to create a stable mock ID. API mode sends
`projectId`, the stored normalized transcript, `targetDurationSeconds`, and
`analysisLanguage`.

Current response:

```json
{
  "analysisId": "analysis_project_01JZ8P",
  "summary": "A concise explainer built around an expectation reversal and delayed resolution.",
  "hookType": "Counter-intuitive claim",
  "hookDuration": 5,
  "hookPurpose": "Challenge the expected answer and create curiosity.",
  "tone": "Urgent, informed, optimistic",
  "pacing": "Fast opening, measured evidence, decisive close",
  "callToAction": "Invite the viewer to reconsider the obvious solution",
  "reusablePatterns": ["Open with an expectation reversal", "Escalate from example to system stakes"],
  "doNotCopy": ["Reference-specific examples", "Distinctive analogies", "Original sentence sequences"],
  "confidence": 0.88,
  "estimatedOriginalDuration": 58,
  "hookMechanics": { "trigger": "Expectation reversal", "curiosityGap": "The alternative is unexplained.", "promisedPayoff": "Reveal the mechanism and larger implication.", "deliveryPattern": "Challenge, delay, reveal, resolve.", "evidenceStart": 0, "evidenceEnd": 5, "evidence": "The expected solution is rejected before context is supplied." },
  "narrativeStyle": { "primaryMode": "Reframe-driven explainer", "narrativeEngine": "A small mechanism expands into system-level stakes.", "progression": ["Assumption", "Alternative", "Mechanism", "Stakes", "Payoff"] },
  "informationFlow": { "pattern": "Assumption → mechanism → stakes → payoff", "explanation": "The mechanism is understood before the stakes expand.", "sequence": ["Assumption", "Mechanism", "Stakes", "Payoff"] },
  "retentionMap": [{ "type": "Open loop", "start": 0, "end": 5, "purpose": "Create an unresolved question.", "evidence": "The answer is delayed." }],
  "structure": [
    { "label": "Hook", "start": 0, "end": 5, "note": "Contradicts the expected solution" },
    { "label": "Context", "start": 5, "end": 14, "note": "Introduces the hidden experiment" },
    { "label": "Mechanism", "start": 14, "end": 27, "note": "Explains how the idea works" },
    { "label": "Reframe", "start": 27, "end": 39, "note": "Expands one building into a city system" },
    { "label": "Tension", "start": 39, "end": 51, "note": "Acknowledges cost and risk" },
    { "label": "Conclusion", "start": 51, "end": 60, "note": "Returns to the future stakes" }
  ],
  "safety": { "longSourceExcerptsIncluded": false, "maxQuotedWords": 0 }
}
```

The UI presents five plain-English storytelling questions and a short reusable
story blueprint while keeping timing and the transcript out of the primary
reading path. The backend generates
`analysisId` and safety metadata, rejects
long source excerpts, validates timeline consistency, strips unknown fields, and
makes at most one JSON repair attempt. The transcript is sent to the configured
LLM but is not stored by this backend. Analysis is reusable only for the exact
transcript/model-contract version.

### `generateScript(project)`

Mock mode reads the topic and current version. API mode sends language, duration,
audience, and allowlisted abstract reference analysis. Initial generation sends
an empty instruction list. It never sends `project.transcript`.

Current response:

```json
{
  "title": "Why the United States cannot abandon Taiwan",
  "version": 1,
  "estimatedSeconds": 59,
  "sections": [
    { "id": "hook", "label": "Hook", "range": "0–5s", "text": "The most important line on a map may be the one ships cannot cross." },
    { "id": "context", "label": "Context", "range": "5–15s", "text": "That is why the topic is less about one headline and more about the system hidden underneath it." },
    { "id": "argument-1", "label": "Main argument 1", "range": "15–27s", "text": "Trade routes, advanced manufacturing, and regional security all converge in the same narrow corridor." },
    { "id": "argument-2", "label": "Main argument 2", "range": "27–40s", "text": "If that corridor becomes unreliable, the shock does not stay local." },
    { "id": "argument-3", "label": "Main argument 3", "range": "40–51s", "text": "Support is therefore not only a promise to one partner." },
    { "id": "conclusion", "label": "Conclusion", "range": "51–57s", "text": "Walking away might look simpler today, but it would make every future crisis harder." },
    { "id": "cta", "label": "CTA", "range": "57–60s", "text": "Follow for one-minute explanations of the forces shaping tomorrow." }
  ]
}
```

The implemented backend adds `scriptId`, derives section IDs/ranges and duration,
and makes one repair attempt for invalid JSON or length. Identical requests are
coalesced/cached within the running process, so retries do not silently create a
new version. This cache is not durable across restarts. User edits invalidate
`project.originalityReview`.

### `reviewOriginality(project)`

Current input: transcript, abstract analysis, and current edited script embedded in the project. API mode sends those explicitly.

Current response:

```json
{
  "status": "passed",
  "overall": 91,
  "scores": { "hook": 88, "structure": 84, "clarity": 94, "duration": 98 },
  "summary": "The draft uses the reference's pacing discipline without repeating its language or subject-specific examples.",
  "overlaps": [
    { "reference": "The real breakthrough is not a single floating building.", "generated": "Support is therefore not only a promise to one partner.", "risk": "Low", "note": "Shared contrast construction, but different wording, meaning, and placement." },
    { "reference": "The cities that prepare now may not have to retreat later.", "generated": "Walking away might look simpler today, but it would make every future crisis harder.", "risk": "Low", "note": "Both close on future consequences; revise only if a more distinct cadence is desired." }
  ],
  "instructions": ["Keep the evidence sequence, but avoid adding any distinctive examples from the reference.", "Retain the final sentence because it resolves the new topic rather than the source story."],
  "disclaimer": "This similarity review is an originality estimate, not a copyright or legal determination."
}
```

The implemented response also includes `reviewId`, `scriptId`,
`originalityEstimate`, and `structureSimilarity`. The backend validates every
phrase against the submitted texts, derives the weighted overall score and
structure-risk band, and applies the configured thresholds. `status` is `passed`
or `failed`; the UI only exposes production approval when passed. Failure to run
the reviewer is an agent error, never a review failure and never a pass.
Identical completed requests are cached in memory by their normalized exact
input; durable persistence remains future work.

### `generateStoryboard(project)`

Mock mode reads the topic and generated script sections. API mode sends the
approved review ID, exact script, format, target duration, requested scene count,
and visual constraints.

Current response (eight items; one shown):

```json
[
  {
    "id": "scene-1",
    "number": 1,
    "start": 0,
    "end": 5,
    "duration": 5,
    "narration": "The most important line on a map may be the one ships cannot cross.",
    "caption": "The line ships cannot cross",
    "visual": "Animated maritime map with a narrow passage highlighted",
    "searchQuery": "map ocean shipping corridor aerial",
    "transition": "Fade up"
  }
]
```

The production screen consumes all fields and expects a non-empty array. The
implemented backend resolves `approvedReviewId` from the in-process Reviewer
registry, requires a passed review for the exact script, preserves every script
word in order, and derives a gap-free timeline ending at the target duration.
The model cannot control narration, IDs, or timing. Search queries remain
unlicensed proposals. A regenerated or edited script invalidates the storyboard.
Review lookup and completed storyboard caching are not durable across restarts.

### `renderVideo(project, onProgress)`

Mock mode reads `format`, `duration`, and `productionSettings` and reports six
progress callbacks. API mode submits the review ID, exact Storyboard, settings,
format, and duration to the implemented Video Producer.

Current progress callbacks:

```json
[
  { "stage": "Planning scenes", "progress": 10 },
  { "stage": "Finding B-roll", "progress": 28 },
  { "stage": "Generating narration", "progress": 48 },
  { "stage": "Creating captions", "progress": 66 },
  { "stage": "Combining scenes", "progress": 84 },
  { "stage": "Rendering final video", "progress": 96 }
]
```

Current final response:

```json
{
  "stage": "Final video ready",
  "progress": 100,
  "completed": true,
  "format": "9:16",
  "duration": 60,
  "voice": "Min — Clear explainer",
  "captionStyle": "Editorial high contrast",
  "music": false,
  "completedAt": "2026-07-18T05:21:42.000Z"
}
```

API mode starts with POST and polls the returned `renderId`. The backend resolves
the passed review and exact stored Storyboard before submitting one idempotent
provider job. The frontend forwards normalized statuses to the progress UI,
stops on `completed` or `failed`, and displays signed `videoUrl` and
`productionPackageUrl` links only for provider completion. Mock completion keeps
the local JSON export. Registries and job idempotency are in process and reset on
server restart.

## Project persistence handoff

The current `createStore()` in `frontend/core.mjs` is synchronous and local-storage-backed. These APIs are contracted but intentionally not called yet:

| Current store operation | Future endpoint | Integration decision |
|---|---|---|
| `store.addProject(createProject(values))` | `POST /api/projects` | Choose optimistic local ID reconciliation and authentication first. |
| `store.getProject(id)` / refresh load | `GET /api/projects/:projectId` | Decide offline/local fallback and conflict behavior. |
| `store.updateProject(id, patch)` | `PATCH /api/projects/:projectId` | Add debounced saves plus ETag/version conflict UI. |

A project-list endpoint is still required before the dashboard can become fully server-backed. It was not in the proposed endpoint set, so the backend engineer must choose `GET /api/projects` pagination/filter semantics before replacing the dashboard store.

## Revision handoff

“Send back to Scriptwriter” preserves reviewer instructions locally before
clearing the stale review. “Write new version” saves current editor changes and
calls `reviseScript(project, revisionInstructions)`. Reviewer instructions are
used when available; otherwise the UI sends a neutral request for distinct
wording while preserving the brief and section functions. Successful revisions
increment the version, link `supersedesScriptId`, and preserve section IDs.

## Error and loading behavior already available

- Each agent step marks its shared pipeline state `in_progress`, `completed`, `revision_required`, or `failed`.
- A failed service stores `{ message, code }`, renders an alert, focuses it, and offers the stage-specific Retry action.
- Successful prior stages remain in local state and are not repeated on retry.
- API errors are normalized in `service-client.mjs` to `message`, `code`, `status`, `retryable`, and `details`.
- The UI preserves `retryable` from API errors. It suppresses Retry for permanent
  configuration and validation failures and shows analysis-specific guidance for
  timeout, rate limit, invalid model response, provider failure, and transcript
  size/analyzability errors.

## Backend acceptance checklist

1. Implement the endpoint envelopes and exact field names in `BACKEND_API_CONTRACT.md`.
2. Validate all agent inputs/outputs against `AGENT_DATA_CONTRACTS.md` before persistence.
3. Enforce passed-review/script-version matching on storyboard and render endpoints.
4. Return stable IDs for transcript, analysis, script, review, storyboard, and render records.
5. Confirm authentication, idempotency, retention, project-list, and concurrency decisions.
6. Run the frontend in API mode against a non-production environment without adding secrets to the browser.
7. Preserve mock mode for deterministic demos and browser tests.
