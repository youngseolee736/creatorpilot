# Phase 3 Scriptwriter Agent Plan

## Desired outcome

CreatorPilot can generate and revise a structured, editable short-video script
through the configured backend LLM provider. The Scriptwriter receives only the
user brief and abstract Script Analyst output, never the raw reference
transcript. Initial generation and revision return stable, validated script
contracts that the existing editor can persist locally.

## Completion evidence

- `POST /api/scripts/generate` returns a validated version-one script.
- `POST /api/scripts/revise` returns a new version linked to the prior script.
- Invalid briefs, malformed model output, unsafe prompt content, unsupported
  lengths, provider failures, and retry behavior are covered by backend tests.
- Per-service frontend configuration can run transcript, analysis, and script
  through the API while later stages remain mocked.
- The browser fixture completes the API-backed path through the Script Editor at
  desktop, tablet, and mobile sizes without console or accessibility failures.

## Journey and states

1. The creator completes transcript extraction and reference analysis.
2. The Scriptwriter receives topic, language, duration, audience, and abstract
   analysis data.
3. The Script Editor shows a validated draft with stable section IDs and timing.
4. Regeneration preserves the current script as revision context and produces a
   new version.
5. Loading and API error states continue to use the existing writer pipeline UI.

## Implementation

- Add Scriptwriter request validation, prompts, output parsing/normalization,
  deterministic timing, and generation/revision orchestration.
- Add script routes and injectable application wiring.
- Generalize LLM-facing error messages so they identify the active agent without
  exposing provider details.
- Connect the existing frontend service client and regeneration action to the
  revision endpoint without changing navigation or visual design.
- Extend backend, frontend, and browser fixture tests.
- Update API, handoff, and setup documentation to reflect Phase 3 behavior and
  limitations.

## Self-review checklist

- Confirm raw transcript data never enters a Scriptwriter request or prompt.
- Confirm generated IDs, versions, ranges, and duration are server controlled.
- Confirm initial generation and revision remain distinguishable and retryable.
- Confirm editor loading, success, and error states remain understandable.
- Confirm keyboard flow and layout remain intact at 1280px, 768px, and 390px.

## Scope notes

This is a localized service integration, not a page redesign, navigation change,
or information-architecture change. Existing documented CreatorPilot design
references remain applicable; new external design research is not required.
Originality review, research/fact retrieval, storyboarding, and rendering remain
mocked.

## Completion report

### Outcome

- Added real initial generation and revision endpoints backed by the shared
  OpenAI-compatible provider.
- Kept raw transcript data outside the Scriptwriter boundary and allowlisted the
  abstract analysis sent to the model.
- Made the backend authoritative for IDs, versions, lineage, section plans,
  ranges, and speaking-time estimates.
- Connected “New version” to the revision endpoint while preserving local edits
  and reviewer guidance.

### Files and evidence

- Backend agent and routes: `backend/src/agents/scriptwriter/`,
  `backend/src/routes/scripts.js`, and `backend/src/app.js`.
- Provider reuse and agent-specific errors: `backend/src/services/llm/`.
- Frontend integration: `frontend/service-client.mjs`, `frontend/app.js`, mock
  services, editor copy, connection/error labels, and project state.
- Tests: `backend/tests/scriptwriter-tests.js`, the Phase 3 browser fixture,
  frontend service tests, browser workflow, and optional live Scriptwriter test.
- Browser screenshots were refreshed under
  `docs/plans/completed/creatorpilot-evidence/`.

### Validation

- Backend: 24 transcript, 27 analysis, and 16 Scriptwriter tests passed.
- Frontend: syntax checks and 15 service/core tests passed.
- Dependency audit: 0 vulnerabilities across 76 packages.
- Browser: API transcript, analysis, initial script, and revision lineage passed;
  the remaining mock workflow also completed.
- Browser viewports: 1280×900, 768×1024, and 390×844 had no horizontal
  overflow. Visible controls had accessible names, keyboard focus was visible,
  route focus was correct, and the browser console/runtime were clean.

### Self-review and revisions

- The first browser fixture used repetitive filler words, which made valid test
  output look like a poor script. Replaced it with coherent topic-specific
  narration while retaining deterministic duration.
- The initial “Write new version” label wrapped awkwardly in the existing page
  heading action. Shortened it to “New version” without changing the action or
  navigation.
- Replaced a browser assertion tied to a hard-coded `conclusion` ID with a
  structural selector because real section IDs correctly follow Analyst labels.

### Limitations

- Live provider validation was skipped because no LLM URL, key, model, or live
  topic was configured. The credential-free provider fixture covered the HTTP
  and browser boundary.
- Idempotency and completed-result caching last only for the running backend
  process; durable version conflict handling requires future persistence work.
- The Scriptwriter has no research/fact-checking source and cannot guarantee
  factual accuracy or originality. The real Originality Reviewer remains future
  work.
