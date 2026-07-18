# CreatorPilot Backend Handoff Map

Status: Phase 1 transcript backend implemented; later workflow services remain mocked.

## Runtime boundary

- `frontend/config.js` is public runtime configuration and defaults to `useMockServices: true`.
- `frontend/service-client.mjs` is the only service selector imported by `frontend/app.js`.
- Mock mode delegates to `frontend/mock-services.mjs` unchanged.
- Per-service mode can route transcript extraction through the Phase 1 Express API
  while analysis, script, review, storyboard, and video remain mocked.
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

Example public API-mode configuration (not enabled in this repository):

```js
window.CREATORPILOT_CONFIG = Object.freeze({
  useMockServices: false,
  apiBaseUrl: "https://api.creatorpilot.example",
  renderPollIntervalMs: 1500,
});
```

## Service summary

| Current function | Current file | Future endpoint | UI consumers | Loading state | Required error state | Polling | Cache |
|---|---|---|---|---|---|---|---|
| `extractTranscript(project)` | `frontend/mock-services.mjs` | `POST /api/transcripts/extract` | `app.js#ensureAnalysis`, `pages/analysis.mjs`, shared pipeline | Extracting reference transcript | Inline agent error with Retry; distinguish invalid/private/no transcript from transient provider failure | No | Cache by canonical video ID + caption language; respect transcript retention policy |
| `analyzeReference(project)` | same | `POST /api/analysis/reference` | `app.js#ensureAnalysis`, `pages/analysis.mjs` | Mapping hook, pacing, and structure | Retry for transient model errors; invalid/short transcript requires new source | No | Cache by transcript content hash + analyzer version |
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

Current input argument is unused in the mock. API mode sends `projectId`, the stored transcript, and target duration.

Current response:

```json
{
  "hookType": "Counter-intuitive claim",
  "hookDuration": 5,
  "targetAudience": "Curious general audience interested in cities and technology",
  "tone": "Urgent, informed, optimistic",
  "pacing": "Fast opening, measured evidence, decisive close",
  "retentionTechniques": ["Expectation reversal", "Concrete visual examples", "Open-loop question", "Future-facing payoff"],
  "callToAction": "Invite the viewer to reconsider the obvious solution",
  "estimatedOriginalDuration": 58,
  "structure": [
    { "label": "Hook", "start": 0, "end": 5, "note": "Contradicts the expected solution" },
    { "label": "Context", "start": 5, "end": 14, "note": "Introduces the hidden experiment" },
    { "label": "Mechanism", "start": 14, "end": 27, "note": "Explains how the idea works" },
    { "label": "Reframe", "start": 27, "end": 39, "note": "Expands one building into a city system" },
    { "label": "Tension", "start": 39, "end": 51, "note": "Acknowledges cost and risk" },
    { "label": "Conclusion", "start": 51, "end": 60, "note": "Returns to the future stakes" }
  ]
}
```

The UI consumes every named summary field and each structure item. The backend should add `analysisId` and safety metadata without removing these fields. It must output abstract mechanics rather than long source excerpts. Analysis is reusable only for the exact transcript/model-contract version.

### `generateScript(project)`

Current input fields read: `topic`, previous `generatedScript.version`. API mode additionally sends language, duration, audience, reference analysis, and revision instructions.

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

The editor requires stable section IDs, editable text, labels/ranges, title, version, and duration estimate. Add `scriptId` server-side. User edits invalidate `project.originalityReview`. A retry must not silently produce multiple versions; the backend needs idempotency/version rules.

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

The real response must also include `reviewId`, `scriptId`, `originalityEstimate`, and `structureSimilarity`. `status` is `passed` or `failed`; the UI only exposes production approval when passed. Failure to run the reviewer is an agent error, never a review failure and never a pass. Cache only an exact script/reference hash.

### `generateStoryboard(project)`

Current input fields read: topic and generated script sections. API mode sends `approvedReviewId`, script, and format.

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

The production screen consumes all fields and expects a non-empty array. The backend must verify that `approvedReviewId` belongs to the exact script version. Do not imply that `searchQuery` results are licensed. A regenerated/edited script invalidates the storyboard.

### `renderVideo(project, onProgress)`

Current input fields read: `format`, `duration`, and `productionSettings`; it reports six progress callbacks before returning.

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

API mode starts with POST and polls the returned `statusUrl`/`renderId`. It forwards each status to the existing progress UI and stops on `completed` or `failed`. The real final result adds signed `videoUrl` and `productionPackageUrl`; the current Export action still creates a local JSON package and must be changed only when real media export is approved. Render start and poll failures require separate recovery so an existing render is not duplicated.

## Project persistence handoff

The current `createStore()` in `frontend/core.mjs` is synchronous and local-storage-backed. These APIs are contracted but intentionally not called yet:

| Current store operation | Future endpoint | Integration decision |
|---|---|---|
| `store.addProject(createProject(values))` | `POST /api/projects` | Choose optimistic local ID reconciliation and authentication first. |
| `store.getProject(id)` / refresh load | `GET /api/projects/:projectId` | Decide offline/local fallback and conflict behavior. |
| `store.updateProject(id, patch)` | `PATCH /api/projects/:projectId` | Add debounced saves plus ETag/version conflict UI. |

A project-list endpoint is still required before the dashboard can become fully server-backed. It was not in the proposed endpoint set, so the backend engineer must choose `GET /api/projects` pagination/filter semantics before replacing the dashboard store.

## Revision handoff

The current “Send back to Scriptwriter” action returns the user to the editor and clears the existing review. It does not call a mock AI revision function. `service-client.mjs` nevertheless exposes `reviseScript(project, revisionInstructions)` for the contracted `POST /api/scripts/revise` endpoint. Before wiring a UI action, product/backend must decide whether revision instructions are entered by the user, copied from the review, or both.

## Error and loading behavior already available

- Each agent step marks its shared pipeline state `in_progress`, `completed`, `revision_required`, or `failed`.
- A failed service stores `{ message, code }`, renders an alert, focuses it, and offers the stage-specific Retry action.
- Successful prior stages remain in local state and are not repeated on retry.
- API errors are normalized in `service-client.mjs` to `message`, `code`, `status`, `retryable`, and `details`.
- The current UI shows Retry for every service error. Before launch, use `retryable` to suppress Retry for permanent validation/access errors and route the user to the field/source that must change.

## Backend acceptance checklist

1. Implement the endpoint envelopes and exact field names in `BACKEND_API_CONTRACT.md`.
2. Validate all agent inputs/outputs against `AGENT_DATA_CONTRACTS.md` before persistence.
3. Enforce passed-review/script-version matching on storyboard and render endpoints.
4. Return stable IDs for transcript, analysis, script, review, storyboard, and render records.
5. Confirm authentication, idempotency, retention, project-list, and concurrency decisions.
6. Run the frontend in API mode against a non-production environment without adding secrets to the browser.
7. Preserve mock mode for deterministic demos and browser tests.
