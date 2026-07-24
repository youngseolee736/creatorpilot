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
- `400`, `404`, and `422` are not retried automatically. One network failure,
  `429`, or `5xx` may be retried after user action.
- Generation POSTs are idempotent within the running backend where the
  corresponding agent stores a canonical request fingerprint. This in-process
  retention resets on restart.

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

Purpose: derive the reference's storytelling logic and demonstrate its Opening,
Build, and Payoff with the customer's new topic, without reproducing source
wording or inventing research. Responsible agent: Script Analyst Agent. Consumed
by: Reference Analysis screen and the compact reference blueprint passed to
later agents.

Required: `projectId`, `targetTopic`, `transcript`, `targetDurationSeconds`. Optional:
`analysisLanguage` is accepted for backward compatibility, but analysis prose is
always normalized to English. The project's language controls the later script,
not the analyst workspace. `targetDurationSeconds` is an integer from 15 through 180.
Transcript text is limited to 100,000 characters in Phase 2. Loading UI: “Mapping
hook, pacing, and structure.” Retry: user-triggered only for network, `429`,
retryable provider errors, invalid model output, or timeouts; validation and
configuration failures require corrected input or server configuration.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "targetTopic": "Why Son Heung-min is outperforming Messi in MLS",
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
    "tone": "Urgent, informed, optimistic",
    "pacing": "Fast opening, measured evidence, decisive close",
    "callToAction": "Invite the viewer to reconsider the obvious solution",
    "reusablePatterns": ["Open with an expectation reversal", "Escalate from one example to system-level stakes"],
    "doNotCopy": ["Reference-specific examples", "Distinctive analogies", "Original sentence sequences"],
    "confidence": 0.88,
    "estimatedOriginalDuration": 58,
    "hookMechanics": { "trigger": "Expectation reversal", "curiosityGap": "The obvious answer is challenged before the alternative is explained.", "promisedPayoff": "Reveal the overlooked mechanism and its larger implication.", "deliveryPattern": "Challenge, delay, progressively reveal, then resolve.", "evidenceStart": 0, "evidenceEnd": 5, "evidence": "The opening rejects the expected solution before giving context." },
    "narrativeStyle": { "primaryMode": "Reframe-driven explainer", "narrativeEngine": "A small mechanism expands into a larger possibility while constraints preserve uncertainty.", "progression": ["Expected answer", "Hidden alternative", "Mechanism", "Scale", "Tension", "Payoff"] },
    "appliedExamples": {
      "opening": "Messi is the MLS benchmark—but what if Son Heung-min is already making the stronger case?",
      "build": "Test Son's case through impact, consistency, and team influence without assuming the answer.",
      "payoff": "Reveal which standard makes Son's case strongest while acknowledging where Messi still leads."
    },
    "informationFlow": { "pattern": "Assumption → alternative → mechanism → scale → objections → implication", "explanation": "The broad stakes arrive only after the mechanism is understandable.", "sequence": ["Assumption", "Alternative", "Explanation", "Scale", "Constraints", "Implication"] },
    "retentionMap": [{ "type": "Open loop", "start": 0, "end": 5, "purpose": "Create a question the ending must resolve.", "evidence": "The alternative is introduced without its full explanation." }],
    "structure": [
      { "label": "Hook", "start": 0, "end": 5, "note": "Contradicts the expected solution" },
      { "label": "Context", "start": 5, "end": 14, "note": "Introduces the hidden experiment" }
    ],
    "safety": { "longSourceExcerptsIncluded": false, "maxQuotedWords": 0 }
  }
}
```

The response focuses on plain-English story logic. Timing remains internal
evidence for validation and is not presented as a user-facing timeline. The UI
asks how the video opens, moves forward, reveals information, holds interest,
and pays off. It never quotes the source or claims to observe visuals, editing,
music, analytics, or private creator intent. The
backend generates `analysisId` and `safety`, removes unknown model
fields, validates section order and duration consistency, and never returns the
raw provider response.

Errors: `400 INVALID_ANALYSIS_REQUEST`; `413 TRANSCRIPT_TOO_LARGE`; `422
TRANSCRIPT_NOT_ANALYZABLE`; `429 LLM_RATE_LIMITED`; `500 LLM_NOT_CONFIGURED` or
`ANALYSIS_INTERNAL_ERROR`; `502 LLM_PROVIDER_ERROR` or `INVALID_LLM_RESPONSE`;
`504 LLM_TIMEOUT`.

## `POST /api/research/topic`

Purpose: turn the user's tailored creative brief and compact reference blueprint
into a source-grounded comparison and story plan before writing. Responsible
agent: Research Agent. Consumed by: Research review screen and Scriptwriter.

Required: `projectId`, `creativeBrief`, and `referenceBlueprint`. Raw transcript
fields are prohibited. The Research Agent uses the OpenAI Responses API
`web_search` tool. Every fact, comparison, and counterpoint must cite at least
one HTTPS URL that also appears in the provider's returned citation/source
metadata; unmatched URLs reject the entire result.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "creativeBrief": {
    "topic": "Why the United States cannot abandon Taiwan",
    "angle": "Explain economic and security consequences without partisan framing.",
    "targetAudience": "Korean viewers interested in geopolitics",
    "viewerGoal": "Understand the issue well enough to explain it",
    "desiredTakeaway": "Withdrawal would reshape supply chains and regional trust",
    "tone": "Clear, informed, conversational",
    "language": "Korean",
    "mustInclude": [],
    "mustAvoid": ["Unverified casualty estimates"],
    "callToAction": "Follow for more one-minute explainers"
  },
  "referenceBlueprint": {
    "analysisId": "an_01JZ8R",
    "hookType": "Counter-intuitive claim",
    "hookPurpose": "Challenge the expected answer",
    "tone": "Urgent, informed",
    "pacing": "Fast opening, measured middle, concise close",
    "ending": "Resolve the opening promise",
    "retentionTechniques": ["Expectation reversal", "Open loop"],
    "structure": [
      { "label": "Hook", "start": 0, "end": 5, "purpose": "Create curiosity" },
      { "label": "Context", "start": 5, "end": 15, "purpose": "Set up the issue" },
      { "label": "Conclusion (Ending)", "start": 15, "end": 60, "purpose": "Resolve the promise" }
    ]
  }
}
```

Success (`201`) includes `researchId`, `summary`, a literal-evidence `verdict`,
and a `narrativeCase` containing the strongest honest route for proving the
requested claim. `narrativeCase` records whether the route is direct, a transparent
reframe, or unavailable; it also supplies the definition, thesis, concession,
and at least two supporting Fact IDs. The response also includes explicit
`criteria`, `comparisonSet`, optional like-for-like `comparisons`, three through
eight role-tagged `facts`, a sourced `counterpoint`, `storyFindings` linked to
fact IDs, normalized `sources`, optional `openQuestions`, `searchedAt`, and
`safety.providerVerifiedSources=true`. A citation is evidence of provenance, not
a factual guarantee.

Errors: `400 INVALID_RESEARCH_BRIEF`; `429 LLM_RATE_LIMITED`; `500
LLM_NOT_CONFIGURED` or `RESEARCH_INTERNAL_ERROR`; `502 LLM_PROVIDER_ERROR` or
`INVALID_RESEARCH_RESPONSE`; `504 LLM_TIMEOUT`.

## `POST /api/scripts/generate`

Purpose: create a new, topic-specific script from the user's tailored brief,
compact reference mechanics, and approved Fact Pack. Responsible agent:
Scriptwriter Agent. Consumed by: Script Editor screen.

Implemented in Phase 3. The endpoint rejects raw transcript fields and allowlists
the abstract analysis before building the prompt. The model supplies the exact
required claim, title, narration, and Fact Pack IDs used per section. The backend
controls claim strategy, IDs, versions, ranges, and speaking-time estimates, and
requires every narrative-case fact, at least two known facts, claim language in
the narration, and a speaking estimate near the requested duration. For demo
stability, the current tolerance is at least twenty seconds or thirty-five percent of
the requested duration, whichever is larger. Identical in-flight requests are coalesced and successful identical
requests reuse the same result within the running process. Persistence across a
server restart is not yet available.

Required: `projectId`, `creativeBrief`, `referenceBlueprint`, `factPack`,
`targetLanguage`, and `targetDurationSeconds`. Optional:
`revisionInstructions` (empty for first draft). The raw transcript and the old
top-level `topic`, `audience`, and `referenceAnalysis` shape are rejected.
Loading UI: “Turning verified findings into a claim-led narration.” Retry: user-triggered; an idempotent
retry must not create duplicate versions.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "creativeBrief": { "topic": "Why the United States cannot abandon Taiwan", "angle": "Explain system consequences", "targetAudience": "Korean viewers interested in geopolitics", "viewerGoal": "Understand why it matters", "desiredTakeaway": "Withdrawal has wider consequences", "tone": "Clear and informed", "language": "English", "mustInclude": [], "mustAvoid": [], "callToAction": "" },
  "targetLanguage": "English",
  "targetDurationSeconds": 60,
  "referenceBlueprint": {
    "analysisId": "an_01JZ8R",
    "hookType": "Counter-intuitive claim",
    "hookPurpose": "Create curiosity",
    "tone": "Urgent, informed, optimistic",
    "pacing": "Fast opening, measured evidence, decisive close",
    "retentionTechniques": ["Expectation reversal", "Open-loop question"],
    "ending": "Resolve the opening promise",
    "structure": [
      { "label": "Hook", "start": 0, "end": 5, "purpose": "Contradicts the expected solution" },
      { "label": "Context", "start": 5, "end": 15, "purpose": "Introduces the issue" },
      { "label": "Conclusion (Ending)", "start": 15, "end": 60, "purpose": "Develops and resolves the new topic" }
    ]
  },
  "factPack": { "researchId": "research_01", "summary": "Grounded claims", "facts": [{ "factId": "fact_1", "claim": "A sourced claim", "explanation": "Why it matters", "confidence": "high", "sourceIds": ["source_1"], "usableInScript": true }, { "factId": "fact_2", "claim": "A second claim", "explanation": "Why it matters", "confidence": "medium", "sourceIds": ["source_1"], "usableInScript": true }, { "factId": "fact_3", "claim": "A third claim", "explanation": "Why it matters", "confidence": "high", "sourceIds": ["source_1"], "usableInScript": true }], "sources": [{ "sourceId": "source_1", "title": "Official source", "url": "https://example.org/report", "domain": "example.org" }], "openQuestions": [] },
  "revisionInstructions": []
}
```

Success (`201`):

```json
{
  "requestId": "req_script_01",
  "data": {
    "scriptId": "sc_01JZ8S",
    "claim": "Why the United States cannot abandon Taiwan",
    "claimStrategy": { "mode": "qualify", "researchStatus": "partially_supported", "explanation": "The script argues the strongest defensible version and addresses the main counterpoint." },
    "usedFactIds": ["fact_1", "fact_2"],
    "title": "Why the United States cannot abandon Taiwan",
    "version": 1,
    "estimatedSeconds": 59,
    "sections": [
      { "id": "hook", "label": "Hook", "range": "0–5s", "text": "Why can the United States not abandon Taiwan? The answer begins beyond the island.", "factIds": ["fact_1"] },
      { "id": "context", "label": "Context", "range": "5–15s", "text": "This story is about the system hidden underneath one headline.", "factIds": ["fact_2"] }
    ]
  }
}
```

Errors: `400 INVALID_SCRIPT_BRIEF`; `429 LLM_RATE_LIMITED`; `500
LLM_NOT_CONFIGURED` or `SCRIPT_INTERNAL_ERROR`; `502 LLM_PROVIDER_ERROR` or
`INVALID_LLM_RESPONSE`; `504 LLM_TIMEOUT`.

## `POST /api/scripts/revise`

Purpose: produce a new script version from explicit review/user instructions. Responsible agent: Scriptwriter Agent. Consumed by: Script Editor after “Send back to Scriptwriter” or “Write new version.” The Phase 3 UI preserves the current draft, calls this endpoint, and stores version lineage locally.

Required: the same `projectId`, `creativeBrief`, `referenceBlueprint`,
`factPack`, language, and duration used for generation, plus `currentScript` and
at least one `revisionInstructions` item. Optional: `preserveSectionIds`.
Loading UI: “Writing a new version.” Retry: user-triggered and idempotent for the
same script version/instructions.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "creativeBrief": { "topic": "Why the United States cannot abandon Taiwan", "angle": "Explain system consequences", "targetAudience": "Korean viewers interested in geopolitics", "viewerGoal": "Understand why it matters", "desiredTakeaway": "Withdrawal has wider consequences", "tone": "Clear and informed", "language": "English", "mustInclude": [], "mustAvoid": [], "callToAction": "" },
  "targetLanguage": "English",
  "targetDurationSeconds": 60,
  "referenceBlueprint": {
    "analysisId": "an_01JZ8R",
    "hookType": "Counter-intuitive claim",
    "hookPurpose": "Create curiosity",
    "tone": "Urgent, informed",
    "pacing": "Fast opening, decisive close",
    "retentionTechniques": ["Expectation reversal"],
    "ending": "Resolve the opening promise",
    "structure": [
      { "label": "Hook", "start": 0, "end": 5, "purpose": "Create curiosity" },
      { "label": "Context", "start": 5, "end": 15, "purpose": "Set up the issue" },
      { "label": "Conclusion (Ending)", "start": 15, "end": 60, "purpose": "Develop and resolve the new topic" }
    ]
  },
  "factPack": { "researchId": "research_01", "summary": "Grounded claims", "facts": [{ "factId": "fact_1", "claim": "A sourced claim", "explanation": "Why it matters", "confidence": "high", "sourceIds": ["source_1"], "usableInScript": true }, { "factId": "fact_2", "claim": "A second claim", "explanation": "Why it matters", "confidence": "medium", "sourceIds": ["source_1"], "usableInScript": true }, { "factId": "fact_3", "claim": "A third claim", "explanation": "Why it matters", "confidence": "high", "sourceIds": ["source_1"], "usableInScript": true }], "sources": [{ "sourceId": "source_1", "title": "Official source", "url": "https://example.org/report", "domain": "example.org" }], "openQuestions": [] },
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

Required: `projectId`, `script`, `format`, and `targetDurationSeconds`.
Optional: `sceneCount` and `visualConstraints`. The backend preserves exact
narration and controls IDs and the gap-free target timeline. Loading UI:
“Planning scenes and visual evidence.” Retry:
user-triggered for transient failures.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "script": {
    "scriptId": "sc_01JZ8S",
    "version": 1,
    "title": "Why the United States cannot abandon Taiwan",
    "estimatedSeconds": 59,
    "sections": [{ "id": "hook", "label": "Hook", "range": "0–5s", "text": "The most important line on a map may be the one ships cannot cross." }]
  },
  "format": "9:16",
  "targetDurationSeconds": 60,
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
      "imagePrompt": "Vertical documentary still of a maritime map, highlighted shipping corridor, no logos, no readable small text",
      "transition": "Fade up"
    }
  ]
}
```

Errors: `400 INVALID_STORYBOARD_INPUT`; `429 LLM_RATE_LIMITED`; `500 LLM_NOT_CONFIGURED` or
`STORYBOARD_INTERNAL_ERROR`; `502 LLM_PROVIDER_ERROR` or
`INVALID_LLM_RESPONSE`; `504 LLM_TIMEOUT`.

## `POST /api/images/generate`

Purpose: generate an optional still image for a storyboard scene. Responsible
service: AI Image Preview provider. Consumed by: Storyboard Preview screen after
the user clicks “Generate key images.”

Required: one usable `imagePrompt`, or enough scene fields for the backend to
build one from `visual`, `caption`, and `narration`. Optional: `projectId`,
`sceneId`, `number`, `format`, `title`, and `aspectRatio`.

Request:

```json
{
  "projectId": "project_01JZ8P",
  "sceneId": "scene-1",
  "number": 1,
  "aspectRatio": "16:9",
  "caption": "The line ships cannot cross",
  "visual": "Animated maritime map with a narrow passage highlighted",
  "narration": "The most important line on a map may be the one ships cannot cross.",
  "imagePrompt": "Vertical documentary still of a maritime map, highlighted shipping corridor, no logos"
}
```

Success (`201`):

```json
{
  "requestId": "req_image_01",
  "data": {
    "imageDataUrl": "data:image/png;base64,...",
    "mediaType": "image/png",
    "model": "google/gemini-3.1-flash-lite-image",
    "prompt": "Vertical documentary still of a maritime map, highlighted shipping corridor, no logos"
  }
}
```

Errors: `400 INVALID_IMAGE_PROMPT`; `429 IMAGE_RATE_LIMITED`; `500
IMAGE_NOT_CONFIGURED` or `IMAGE_INTERNAL_ERROR`; `502 IMAGE_PROVIDER_ERROR` or
`INVALID_IMAGE_RESPONSE`; `504 IMAGE_TIMEOUT`.

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
      "researcher": { "status": "waiting", "detail": "Waiting for the previous stage" },
      "writer": { "status": "waiting", "detail": "Waiting for the previous stage" },
      "storyboard": { "status": "waiting", "detail": "Waiting for the previous stage" }
    }
  }
}
```

Errors: `400 INVALID_PROJECT`; `409 CLIENT_PROJECT_ID_EXISTS`; `422 UNSUPPORTED_PROJECT_CONFIGURATION`; `429 RATE_LIMITED`; `500 PROJECT_CREATE_FAILED`.

## `GET /api/projects/:projectId`

Purpose: restore the complete project/workflow after refresh or on another device. Responsible service: Project Service. Consumed by: every project route and Dashboard.

Required path field: `projectId`. Optional query field:
`include=transcript,analysis,research,script,storyboard`. Loading: project
skeleton/agent status; current local-storage restore remains immediate. Retry:
one user-triggered retry for transient failures; `404` returns
project-unavailable UI.

Request: `GET /api/projects/project_01JZ8P?include=transcript,analysis,research,script,storyboard`

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
    "status": "storyboard_ready",
    "createdAt": "2026-07-18T05:10:00Z",
    "updatedAt": "2026-07-18T05:19:00Z",
    "transcript": { "transcriptId": "tr_01JZ8Q", "title": "Reference", "text": "...", "wordCount": 92, "estimatedDuration": 58 },
    "analysis": { "analysisId": "an_01JZ8R", "hookType": "Counter-intuitive claim", "structure": [] },
    "research": { "researchId": "research_01JZ8R", "facts": [], "sources": [] },
    "generatedScript": { "scriptId": "sc_01JZ8S", "version": 1, "title": "Why the United States cannot abandon Taiwan", "estimatedSeconds": 59, "sections": [] },
    "storyboard": [],
    "pipeline": { "transcript": { "status": "completed", "detail": "Transcript ready" }, "analyst": { "status": "completed", "detail": "Structure mapped" }, "researcher": { "status": "completed", "detail": "Fact Pack ready" }, "writer": { "status": "completed", "detail": "Draft 1 ready" }, "storyboard": { "status": "completed", "detail": "Storyboard preview ready" } }
  }
}
```

Errors: `400 INVALID_PROJECT_ID`; `401 AUTHENTICATION_REQUIRED`; `403 PROJECT_ACCESS_DENIED`; `404 PROJECT_NOT_FOUND`; `429 RATE_LIMITED`; `500 PROJECT_READ_FAILED`.

## `PATCH /api/projects/:projectId`

Purpose: persist user edits and allowed workflow metadata. Responsible service:
Project Service. Consumed by: Script Editor, Storyboard Preview, and project
title edits.

Required path field: `projectId`; request must contain at least one mutable
field. Optional mutable fields: `title`, `generatedScript`, `expectedUpdatedAt`.
Server-owned agent results/status must not be arbitrarily overwritten. Loading:
optimistic local save with visible failure recovery. Retry: safe only with
`expectedUpdatedAt` or an ETag/version precondition.

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
