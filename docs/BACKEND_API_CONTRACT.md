# CreatorPilot Backend API Contract

Status: frontend handoff contract, version 1  
Base path: `/api`  
Transport: HTTPS JSON  
Authentication: undecided; credentials and provider keys must never be shipped in the frontend

## Conventions

- Request and response bodies use `application/json; charset=utf-8`.
- Times are ISO 8601 UTC strings. Durations are integer seconds.
- IDs are opaque strings. The client must not derive meaning from them.
- Successful responses use `{ "requestId": "req_...", "data": ... }`.
- Errors use the envelope below. `retryable` controls whether the existing Retry action should be offered.
- `400`, `404`, and `422` are not retried automatically. One network failure, `429`, or `5xx` may be retried after user action. Rendering status polling is the only automatic retry loop.
- Idempotency keys are recommended for generation and render POSTs. The frontend adapter does not yet send them; the backend engineer must choose the header name and retention window.

```json
{
  "requestId": "req_01JZ8Q4C",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "youtubeUrl must be a public YouTube URL.",
    "retryable": false,
    "details": [{ "field": "youtubeUrl", "reason": "invalid_url" }]
  }
}
```

## `POST /api/transcripts/extract`

Purpose: validate a YouTube reference and extract a normalized transcript. Responsible tool: Transcript Extractor Tool. Consumed by: Reference Analysis screen before the Script Analyst runs.

Required: `projectId`, `youtubeUrl`, `targetLanguage`. Optional: `preferredCaptionLanguage`. Loading UI: “Extracting reference transcript.” Retry: user-triggered for network, `429`, provider timeout, or `5xx`; do not retry private/deleted/unsupported videos.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "youtubeUrl": "https://www.youtube.com/watch?v=abc123",
  "targetLanguage": "English",
  "preferredCaptionLanguage": "en"
}
```

Success (`200`):

`title` and `language` may be `null` when the selected caption provider does not
return that metadata. Transcript text and normalized segments remain required.

```json
{
  "requestId": "req_extract_01",
  "data": {
    "transcriptId": "tr_01JZ8Q",
    "source": "youtube_captions",
    "title": "How coastal cities could move onto the water",
    "text": "Most people think the future of coastal cities is higher sea walls...",
    "language": "en",
    "wordCount": 92,
    "estimatedDuration": 58,
    "segments": [
      { "start": 0, "end": 4.8, "text": "Most people think the future of coastal cities is higher sea walls." }
    ]
  }
}
```

Errors: `400 INVALID_YOUTUBE_URL`; `404 VIDEO_NOT_FOUND` or `TRANSCRIPT_UNAVAILABLE`; `422 VIDEO_NOT_PUBLIC`; `429 PROVIDER_RATE_LIMITED`; `502 TRANSCRIPT_PROVIDER_ERROR`; `504 TRANSCRIPT_TIMEOUT`. Every error uses the common envelope. Phase 1 uses `404 TRANSCRIPT_UNAVAILABLE` rather than the earlier proposed `409` because absence of captions is a missing upstream resource and the approved Phase 1 requirements explicitly standardize that state as `404`.

## `POST /api/analysis/reference`

Purpose: derive abstract hook, pacing, retention, and structural patterns without reproducing long source excerpts. Responsible agent: Script Analyst Agent. Consumed by: Reference Analysis screen.

Required: `projectId`, `transcript`, `targetDurationSeconds`. Optional:
`analysisLanguage`. `targetDurationSeconds` is an integer from 15 through 180.
Transcript text is limited to 100,000 characters in Phase 2. Loading UI: “Mapping
hook, pacing, and structure.” Retry: user-triggered only for network, `429`,
retryable provider errors, invalid model output, or timeouts; validation and
configuration failures require corrected input or server configuration.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "transcript": {
    "transcriptId": "tr_01JZ8Q",
    "source": "youtube_captions",
    "title": null,
    "language": "en",
    "text": "Most people think the future of coastal cities is higher sea walls...",
    "wordCount": 92,
    "estimatedDuration": 58,
    "segments": [{ "start": 0, "end": 4.8, "text": "Most people think the future..." }]
  },
  "targetDurationSeconds": 60,
  "analysisLanguage": "English"
}
```

Success (`200`):

```json
{
  "requestId": "req_analysis_01",
  "data": {
    "analysisId": "an_01JZ8R",
    "summary": "A concise explainer built around an expectation reversal and delayed resolution.",
    "hookType": "Counter-intuitive claim",
    "hookDuration": 5,
    "hookPurpose": "Challenge the expected answer and create curiosity.",
    "targetAudience": "Curious general audience interested in cities and technology",
    "tone": "Urgent, informed, optimistic",
    "contentPromise": "Explain how an overlooked mechanism changes the familiar problem.",
    "pacing": "Fast opening, measured evidence, decisive close",
    "retentionTechniques": ["Expectation reversal", "Concrete visual examples", "Open-loop question"],
    "openLoops": ["Delay the full implication of the opening reframe until the conclusion."],
    "transitions": ["Move from familiar assumption to mechanism, tension, and resolution."],
    "callToAction": "Invite the viewer to reconsider the obvious solution",
    "reusablePatterns": ["Open with an expectation reversal", "Escalate from one example to system-level stakes"],
    "doNotCopy": ["Reference-specific examples", "Distinctive analogies", "Original sentence sequences"],
    "confidence": 0.88,
    "estimatedOriginalDuration": 58,
    "structure": [
      { "label": "Hook", "start": 0, "end": 5, "note": "Contradicts the expected solution" },
      { "label": "Context", "start": 5, "end": 14, "note": "Introduces the hidden experiment" }
    ],
    "safety": { "longSourceExcerptsIncluded": false, "maxQuotedWords": 0 }
  }
}
```

The response retains the Phase 1 frontend fields and adds the Phase 2 analytical
detail. The backend generates `analysisId` and `safety`, removes unknown model
fields, validates section order and duration consistency, and never returns the
raw provider response.

Errors: `400 INVALID_ANALYSIS_REQUEST`; `413 TRANSCRIPT_TOO_LARGE`; `422
TRANSCRIPT_NOT_ANALYZABLE`; `429 LLM_RATE_LIMITED`; `500 LLM_NOT_CONFIGURED` or
`ANALYSIS_INTERNAL_ERROR`; `502 LLM_PROVIDER_ERROR` or `INVALID_LLM_RESPONSE`;
`504 LLM_TIMEOUT`.

## `POST /api/scripts/generate`

Purpose: create a new, topic-specific script using only abstract reference mechanics. Responsible agent: Scriptwriter Agent. Consumed by: Script Editor screen.

Implemented in Phase 3. The endpoint rejects raw transcript fields and allowlists
the abstract analysis before building the prompt. The model supplies only title
and narration text; the backend controls IDs, versions, ranges, and speaking-time
estimates. Identical in-flight requests are coalesced and successful identical
requests reuse the same result within the running process. Persistence across a
server restart is not yet available.

Required: `projectId`, `topic`, `targetLanguage`, `targetDurationSeconds`, `audience`, `referenceAnalysis`. Optional: `revisionInstructions` (empty for first draft). Loading UI: “Drafting original narration.” Retry: user-triggered; an idempotent retry must not create duplicate versions.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "topic": "Why the United States cannot abandon Taiwan",
  "targetLanguage": "English",
  "targetDurationSeconds": 60,
  "audience": "Curious general audience interested in geopolitics",
  "referenceAnalysis": {
    "analysisId": "an_01JZ8R",
    "hookType": "Counter-intuitive claim",
    "tone": "Urgent, informed, optimistic",
    "pacing": "Fast opening, measured evidence, decisive close",
    "retentionTechniques": ["Expectation reversal", "Open-loop question"],
    "doNotCopy": ["Reference examples", "Distinctive sentence sequences"],
    "structure": [
      { "label": "Hook", "start": 0, "end": 5, "note": "Contradicts the expected solution" },
      { "label": "Development", "start": 5, "end": 60, "note": "Develops and resolves the new topic" }
    ]
  },
  "revisionInstructions": []
}
```

Success (`201`):

```json
{
  "requestId": "req_script_01",
  "data": {
    "scriptId": "sc_01JZ8S",
    "title": "Why the United States cannot abandon Taiwan",
    "version": 1,
    "estimatedSeconds": 59,
    "sections": [
      { "id": "hook", "label": "Hook", "range": "0–5s", "text": "The most important line on a map may be the one ships cannot cross." },
      { "id": "context", "label": "Context", "range": "5–15s", "text": "This story is about the system hidden underneath one headline." }
    ]
  }
}
```

Errors: `400 INVALID_SCRIPT_BRIEF`; `429 LLM_RATE_LIMITED`; `500
LLM_NOT_CONFIGURED` or `SCRIPT_INTERNAL_ERROR`; `502 LLM_PROVIDER_ERROR` or
`INVALID_LLM_RESPONSE`; `504 LLM_TIMEOUT`.

## `POST /api/scripts/review`

Purpose: estimate originality and production quality; it is not copyright clearance. Responsible agent: Originality Reviewer Agent. Consumed by: Originality Review screen.

Required: `projectId`, `referenceAnalysis`, `referenceTranscript`, `script`. Optional: `thresholds`. Loading UI: “Comparing language and story structure.” Retry: user-triggered for transient failures; the same script version should return the same stored review when possible.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "referenceAnalysis": { "analysisId": "an_01JZ8R", "hookType": "Counter-intuitive claim" },
  "referenceTranscript": { "transcriptId": "tr_01JZ8Q", "text": "Most people think the future..." },
  "script": {
    "scriptId": "sc_01JZ8S",
    "title": "Why the United States cannot abandon Taiwan",
    "version": 1,
    "estimatedSeconds": 59,
    "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "The most important line on a map may be the one ships cannot cross." }]
  },
  "thresholds": { "minimumOverall": 80, "maximumPhraseOverlapRisk": "medium" }
}
```

Success (`200`):

```json
{
  "requestId": "req_review_01",
  "data": {
    "reviewId": "rv_01JZ8T",
    "scriptId": "sc_01JZ8S",
    "status": "passed",
    "overall": 91,
    "originalityEstimate": 91,
    "structureSimilarity": { "score": 34, "risk": "low", "note": "Only abstract pacing mechanics are shared." },
    "scores": { "hook": 88, "structure": 84, "clarity": 94, "duration": 98 },
    "summary": "The draft uses pacing discipline without repeating source language or examples.",
    "overlaps": [
      {
        "reference": "The real breakthrough is not a single floating building.",
        "generated": "Support is therefore not only a promise to one partner.",
        "risk": "Low",
        "note": "Shared contrast construction, but different wording and meaning."
      }
    ],
    "instructions": ["Avoid distinctive examples from the reference."],
    "disclaimer": "This similarity review is an originality estimate, not a copyright or legal determination."
  }
}
```

Errors: `400 INVALID_REVIEW_INPUT`; `404 SCRIPT_OR_REFERENCE_NOT_FOUND`; `409 REVIEW_IN_PROGRESS`; `422 SCRIPT_EMPTY`; `429 MODEL_RATE_LIMITED`; `502 REVIEW_PROVIDER_ERROR`; `504 REVIEW_TIMEOUT`.

## `POST /api/scripts/revise`

Purpose: produce a new script version from explicit review/user instructions. Responsible agent: Scriptwriter Agent. Consumed by: Script Editor after “Send back to Scriptwriter” or “Write new version.” The Phase 3 UI preserves the current draft, calls this endpoint, and stores version lineage locally.

Required: `projectId`, topic/language/duration/audience, `referenceAnalysis`, `currentScript`, and at least one `revisionInstructions` item. Optional: `preserveSectionIds`. Loading UI: “Writing a new version.” Retry: user-triggered and idempotent for the same script version/instructions.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "topic": "Why the United States cannot abandon Taiwan",
  "targetLanguage": "English",
  "targetDurationSeconds": 60,
  "audience": "Curious general audience interested in geopolitics",
  "referenceAnalysis": {
    "analysisId": "an_01JZ8R",
    "hookType": "Counter-intuitive claim",
    "tone": "Urgent, informed",
    "pacing": "Fast opening, decisive close",
    "retentionTechniques": ["Expectation reversal"],
    "doNotCopy": ["Reference examples", "Distinctive sentence sequences"],
    "structure": [
      { "label": "Hook", "start": 0, "end": 5, "note": "Create curiosity" },
      { "label": "Development", "start": 5, "end": 60, "note": "Develop and resolve the new topic" }
    ]
  },
  "currentScript": {
    "scriptId": "sc_01JZ8S",
    "version": 1,
    "title": "Why the United States cannot abandon Taiwan",
    "estimatedSeconds": 59,
    "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "The most important line on a map may be the one ships cannot cross." }]
  },
  "revisionInstructions": ["Replace the contrast cadence in the conclusion."],
  "preserveSectionIds": true
}
```

Success (`201`):

```json
{
  "requestId": "req_revision_01",
  "data": {
    "scriptId": "sc_01JZ8V",
    "supersedesScriptId": "sc_01JZ8S",
    "title": "Why the United States cannot abandon Taiwan",
    "version": 2,
    "estimatedSeconds": 58,
    "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "One narrow corridor can reshape decisions made an ocean away." }]
  }
}
```

Errors: `400 REVISION_INSTRUCTIONS_REQUIRED` or `INVALID_SCRIPT_BRIEF`; `429
LLM_RATE_LIMITED`; `500 LLM_NOT_CONFIGURED` or `SCRIPT_INTERNAL_ERROR`; `502
LLM_PROVIDER_ERROR` or `INVALID_LLM_RESPONSE`; `504 LLM_TIMEOUT`.

## `POST /api/storyboards/generate`

Purpose: turn an approved script into timed scenes and production metadata. Responsible agent: Storyboard Agent. Consumed by: Storyboard/Production screen.

Required: `projectId`, `approvedReviewId`, `script`, `format`. Optional: `sceneCount`, `visualConstraints`. The backend must reject scripts whose linked review did not pass. Loading UI: “Planning scenes and visual evidence.” Retry: user-triggered for transient failures.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "approvedReviewId": "rv_01JZ8T",
  "script": {
    "scriptId": "sc_01JZ8S",
    "version": 1,
    "title": "Why the United States cannot abandon Taiwan",
    "estimatedSeconds": 59,
    "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "The most important line on a map may be the one ships cannot cross." }]
  },
  "format": "9:16",
  "sceneCount": 8,
  "visualConstraints": ["No graphic violence", "Use licensed or generated assets only"]
}
```

Success (`201`):

```json
{
  "requestId": "req_storyboard_01",
  "data": [
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
}
```

Errors: `400 INVALID_STORYBOARD_INPUT`; `403 SCRIPT_NOT_APPROVED`; `404 PROJECT_SCRIPT_OR_REVIEW_NOT_FOUND`; `409 STORYBOARD_IN_PROGRESS`; `422 DURATION_MISMATCH`; `429 MODEL_RATE_LIMITED`; `502 STORYBOARD_PROVIDER_ERROR`; `504 STORYBOARD_TIMEOUT`.

## `POST /api/videos/render`

Purpose: start an asynchronous video render from an approved script/storyboard. Responsible agent/tool: Video Producer Agent plus rendering provider. Consumed by: Production screen.

Required: `projectId`, `approvedReviewId`, `storyboard`, `productionSettings`, `format`, `durationSeconds`. Optional: `callbackUrl` (server-to-server only). Loading UI: progress panel begins immediately. Retry: do not automatically repeat POST; reuse an idempotency key or query the returned `renderId`.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "approvedReviewId": "rv_01JZ8T",
  "storyboard": [{ "id": "scene-1", "start": 0, "end": 5, "narration": "The most important line...", "visual": "Animated maritime map", "caption": "The line ships cannot cross", "searchQuery": "map ocean shipping corridor aerial", "transition": "Fade up" }],
  "productionSettings": { "voice": "Min — Clear explainer", "captions": "Editorial high contrast", "music": false },
  "format": "9:16",
  "durationSeconds": 60
}
```

Success (`202`):

```json
{
  "requestId": "req_render_01",
  "data": {
    "renderId": "render_01JZ8W",
    "status": "queued",
    "stage": "Preparing production",
    "progress": 2,
    "completed": false,
    "statusUrl": "/api/videos/render_01JZ8W/status"
  }
}
```

Errors: `400 INVALID_RENDER_INPUT`; `403 SCRIPT_NOT_APPROVED`; `404 PROJECT_OR_STORYBOARD_NOT_FOUND`; `409 RENDER_ALREADY_EXISTS`; `422 ASSET_OR_TIMELINE_INVALID`; `429 RENDER_CAPACITY_LIMITED`; `502 RENDER_PROVIDER_ERROR`.

## `GET /api/videos/:renderId/status`

Purpose: report render progress and final deliverables. Responsible tool: rendering provider adapter. Consumed by: Production progress and result screens.

Required path field: `renderId`. Optional query field: `includeDiagnostics=false`. Loading: poll every 1.5 seconds in API mode while queued/running; stop on completed, failed, navigation away, or a practical timeout chosen by the backend team. Retry: exponential backoff after network/`429`/`5xx`; honor `Retry-After`.

Request: `GET /api/videos/render_01JZ8W/status`

Success while running (`200`):

```json
{
  "requestId": "req_status_01",
  "data": { "renderId": "render_01JZ8W", "status": "running", "stage": "Creating captions", "progress": 66, "completed": false, "updatedAt": "2026-07-18T05:20:10Z" }
}
```

Success when complete (`200`):

```json
{
  "requestId": "req_status_02",
  "data": {
    "renderId": "render_01JZ8W",
    "status": "completed",
    "stage": "Final video ready",
    "progress": 100,
    "completed": true,
    "format": "9:16",
    "duration": 60,
    "voice": "Min — Clear explainer",
    "captionStyle": "Editorial high contrast",
    "music": false,
    "completedAt": "2026-07-18T05:21:42Z",
    "videoUrl": "https://media.example.test/renders/render_01JZ8W.mp4",
    "productionPackageUrl": "https://media.example.test/renders/render_01JZ8W/package.json"
  }
}
```

Errors: `404 RENDER_NOT_FOUND`; `410 RENDER_EXPIRED`; `429 STATUS_RATE_LIMITED`; `502 RENDER_PROVIDER_ERROR`. A terminal failure may also be returned as `200` with `data.status: "failed"` and a structured `data.error` so polling can stop deterministically.

## `POST /api/projects`

Purpose: persist a new project before agent work starts. Responsible service: Project Service. Consumed by: Create Project and Dashboard; current frontend keeps this data in local storage until cloud persistence is approved.

Required: `topic`, `referenceUrl`, `language`, `duration`, `format`. Optional: `title`, `clientProjectId`. Loading: disable form submission until complete once integrated. Retry: safe with `clientProjectId` as idempotency key.

Request:

```json
{
  "clientProjectId": "project-1721278800000",
  "title": "Why the United States cannot abandon Taiwan",
  "topic": "Why the United States cannot abandon Taiwan",
  "referenceUrl": "https://youtube.com/watch?v=abc123",
  "language": "English",
  "duration": 60,
  "format": "9:16"
}
```

Success (`201`):

```json
{
  "requestId": "req_project_create_01",
  "data": {
    "id": "project_01JZ8P",
    "title": "Why the United States cannot abandon Taiwan",
    "topic": "Why the United States cannot abandon Taiwan",
    "referenceUrl": "https://youtube.com/watch?v=abc123",
    "language": "English",
    "duration": 60,
    "format": "9:16",
    "status": "reference_added",
    "createdAt": "2026-07-18T05:10:00Z",
    "updatedAt": "2026-07-18T05:10:00Z",
    "pipeline": {
      "transcript": { "status": "waiting", "detail": "Waiting for the previous stage" },
      "analyst": { "status": "waiting", "detail": "Waiting for the previous stage" },
      "writer": { "status": "waiting", "detail": "Waiting for the previous stage" },
      "reviewer": { "status": "waiting", "detail": "Waiting for the previous stage" },
      "producer": { "status": "waiting", "detail": "Waiting for the previous stage" }
    }
  }
}
```

Errors: `400 INVALID_PROJECT`; `409 CLIENT_PROJECT_ID_EXISTS`; `422 UNSUPPORTED_PROJECT_CONFIGURATION`; `429 RATE_LIMITED`; `500 PROJECT_CREATE_FAILED`.

## `GET /api/projects/:projectId`

Purpose: restore the complete project/workflow after refresh or on another device. Responsible service: Project Service. Consumed by: every project route and Dashboard.

Required path field: `projectId`. Optional query field: `include=transcript,analysis,script,review,storyboard,render`. Loading: project skeleton/agent status; current local-storage restore remains immediate. Retry: one user-triggered retry for transient failures; `404` returns project-unavailable UI.

Request: `GET /api/projects/project_01JZ8P?include=transcript,analysis,script,review,storyboard,render`

Success (`200`):

```json
{
  "requestId": "req_project_get_01",
  "data": {
    "id": "project_01JZ8P",
    "title": "Why the United States cannot abandon Taiwan",
    "topic": "Why the United States cannot abandon Taiwan",
    "referenceUrl": "https://youtube.com/watch?v=abc123",
    "language": "English",
    "duration": 60,
    "format": "9:16",
    "status": "under_review",
    "createdAt": "2026-07-18T05:10:00Z",
    "updatedAt": "2026-07-18T05:19:00Z",
    "transcript": { "transcriptId": "tr_01JZ8Q", "title": "Reference", "text": "...", "wordCount": 92, "estimatedDuration": 58 },
    "analysis": { "analysisId": "an_01JZ8R", "hookType": "Counter-intuitive claim", "structure": [] },
    "generatedScript": { "scriptId": "sc_01JZ8S", "version": 1, "title": "Why the United States cannot abandon Taiwan", "estimatedSeconds": 59, "sections": [] },
    "originalityReview": { "reviewId": "rv_01JZ8T", "status": "passed", "overall": 91, "scores": { "hook": 88, "structure": 84, "clarity": 94, "duration": 98 }, "overlaps": [], "instructions": [], "disclaimer": "This similarity review is an originality estimate, not a copyright or legal determination." },
    "storyboard": [],
    "render": null,
    "productionSettings": { "voice": "Sora — Warm documentary", "captions": "Editorial high contrast", "music": true },
    "pipeline": { "transcript": { "status": "completed", "detail": "Transcript ready" }, "analyst": { "status": "completed", "detail": "Structure mapped" }, "writer": { "status": "completed", "detail": "Draft 1 ready" }, "reviewer": { "status": "completed", "detail": "Originality estimate passed" }, "producer": { "status": "waiting", "detail": "Awaiting approval" } }
  }
}
```

Errors: `400 INVALID_PROJECT_ID`; `401 AUTHENTICATION_REQUIRED`; `403 PROJECT_ACCESS_DENIED`; `404 PROJECT_NOT_FOUND`; `429 RATE_LIMITED`; `500 PROJECT_READ_FAILED`.

## `PATCH /api/projects/:projectId`

Purpose: persist user edits, production settings, and allowed workflow metadata. Responsible service: Project Service. Consumed by: Script Editor, Production settings, and project title edits.

Required path field: `projectId`; request must contain at least one mutable field. Optional mutable fields: `title`, `generatedScript`, `productionSettings`, `expectedUpdatedAt`. Server-owned agent results/status must not be arbitrarily overwritten. Loading: optimistic local save with visible failure recovery. Retry: safe only with `expectedUpdatedAt` or an ETag/version precondition.

Request:

```json
{
  "title": "Why Taiwan matters to global trade",
  "generatedScript": {
    "scriptId": "sc_01JZ8S",
    "version": 1,
    "title": "Why Taiwan matters to global trade",
    "estimatedSeconds": 59,
    "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "A single shipping lane can change the balance of an entire region." }]
  },
  "productionSettings": { "voice": "Min — Clear explainer", "captions": "Editorial high contrast", "music": false },
  "expectedUpdatedAt": "2026-07-18T05:19:00Z"
}
```

Success (`200`):

```json
{
  "requestId": "req_project_patch_01",
  "data": {
    "id": "project_01JZ8P",
    "title": "Why Taiwan matters to global trade",
    "status": "script_generated",
    "generatedScript": { "scriptId": "sc_01JZ8S", "version": 1, "title": "Why Taiwan matters to global trade", "estimatedSeconds": 59, "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "A single shipping lane can change the balance of an entire region." }] },
    "productionSettings": { "voice": "Min — Clear explainer", "captions": "Editorial high contrast", "music": false },
    "updatedAt": "2026-07-18T05:25:00Z"
  }
}
```

Errors: `400 NO_MUTABLE_FIELDS`; `401 AUTHENTICATION_REQUIRED`; `403 PROJECT_ACCESS_DENIED`; `404 PROJECT_NOT_FOUND`; `409 PROJECT_VERSION_CONFLICT`; `422 INVALID_PROJECT_PATCH`; `429 RATE_LIMITED`; `500 PROJECT_UPDATE_FAILED`.

## Frontend/backend decisions still open

1. Authentication/session and project ownership model.
2. Idempotency header name, retention window, and conflict response.
3. Whether transcript text may be persisted and for how long.
4. Render status transport: keep polling (contracted here) or add SSE/WebSocket later.
5. Signed media URL lifetime and production-package contents.
6. Project list endpoint/pagination for replacing the local dashboard seed; it is intentionally outside the proposed endpoint list.
7. Concurrency control for script edits (`ETag` vs `expectedUpdatedAt`).
