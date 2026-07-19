# Phase 5 Storyboard Agent Plan

## Desired outcome

CreatorPilot can turn a server-verified, passed script review into a timed visual
production plan through the configured backend LLM provider. The backend owns
approval authorization, storyboard identity, exact narration, scene order, and
the full target-duration timeline; the model proposes only bounded visual and
editorial metadata.

## Completion evidence

- `POST /api/storyboards/generate` resolves `approvedReviewId` from the running
  Reviewer registry and rejects missing, failed, or script-mismatched reviews.
- The returned scenes preserve all script narration in order and cover exactly
  the requested duration without gaps or overlaps.
- Model output cannot set storyboard IDs, script IDs, scene IDs, scene numbers,
  timing, duration, or narration.
- Malformed output receives at most one repair attempt; invalid inputs,
  authorization failures, provider failures, and retry behavior are tested.
- Per-service frontend configuration can run through Storyboard via API while
  video rendering remains mocked.
- The browser fixture completes the API-backed journey through Storyboard at
  desktop, tablet, and mobile sizes without console or accessibility failures.

## Journey and states

1. A creator approves a passed originality review for the exact current script.
2. The backend resolves and verifies that review before calling the Storyboard
   Agent.
3. The backend divides the exact narration into the requested scene count and
   supplies immutable scene slots to the model.
4. The model proposes captions, visual direction, search queries, and transitions
   for each slot.
5. The backend validates the proposals and returns stable, timed scene records to
   the existing production board.

## Implementation

- Add a Reviewer lookup registry for server-side approval resolution.
- Add Storyboard request validation, deterministic narration/timing planning,
  prompts, output parsing/normalization, one repair attempt, and idempotency.
- Add an injectable storyboard route and application wiring.
- Connect the frontend service payload, configuration, fixture, and tests to API
  mode without changing navigation or visual design.
- Update setup, API, handoff, product scope, and agent-contract documentation.

## Self-review checklist

- Confirm missing, failed, or stale reviews never reach the model.
- Confirm every script word is preserved in order and model narration is ignored.
- Confirm scene IDs, order, timing, and total duration are server controlled.
- Confirm search queries are clearly proposals and never imply asset licensing.
- Confirm loading, success, retry, refresh, responsive layout, accessibility, and
  the later mock render flow remain understandable.

## Scope notes

This is a localized service integration using the existing production board. It
does not redesign the page, change navigation, fetch media, license assets, or
implement video rendering. Existing CreatorPilot design references remain
applicable; no new external design research is required.

## Completion report

### Outcome

- Added a real OpenAI-compatible Storyboard endpoint authorized by the running
  Originality Reviewer registry.
- Preserved the full script narration in order and made the backend authoritative
  for storyboard/scene IDs, scene order, timing, duration, and script lineage.
- Limited model output to captions, visual direction, search queries, and
  transitions, with one structured repair attempt and in-process idempotency.
- Connected the existing production board to Storyboard API mode while keeping
  video rendering and export clearly mocked.

### Design evidence

- This localized integration reused the production-board patterns documented in
  `docs/DESIGN_REFERENCES.md`; no new page, layout, navigation, or visual identity
  was introduced.
- The refreshed 1280px Storyboard screenshot was inspected. Agent identity,
  eight-scene hierarchy, total duration, narration, visual direction, search
  query, transition, settings, and mock-render boundary remain legible.

### Files changed

- Storyboard backend: `backend/src/agents/storyboard/`,
  `backend/src/routes/storyboards.js`, and `backend/src/app.js`.
- Approval registry: `backend/src/agents/originality-reviewer/originality-reviewer.js`.
- Tests and fixture: `backend/tests/storyboard-tests.js`,
  `backend/tests/live-storyboard.js`, `backend/tests/browser-fixture-server.js`,
  `frontend/tests/creatorpilot.test.mjs`, and `frontend/tests/browser-cdp.py`.
- Frontend integration: `frontend/service-client.mjs`, `frontend/config.js`,
  `frontend/components.mjs`, and `frontend/pages/production.mjs`.
- Setup and contracts: `README.md`, `backend/package.json`,
  `docs/PROJECT_SPEC.md`, `docs/AGENT_DATA_CONTRACTS.md`,
  `docs/BACKEND_API_CONTRACT.md`, and `docs/BACKEND_HANDOFF.md`.
- Browser evidence: refreshed screenshots under
  `docs/plans/completed/creatorpilot-evidence/`.

### Validation

- Backend: 24 transcript, 27 analysis, 16 Scriptwriter, 13 Reviewer, and 15
  Storyboard tests passed (95 total).
- Frontend: syntax checks, Python compilation, and 19 service/core/rendering
  tests passed.
- Dependency audit: 0 vulnerabilities across 76 packages.
- Browser: Transcript, Analyst, Scriptwriter generation/revision, Reviewer
  review/re-review, and Storyboard all ran through the API; the later mock render
  and export flow completed in a clean Chrome profile.
- Browser confirmed eight API scenes, fixture-specific metadata, exact 60-second
  timeline completion, refresh persistence, accessible control names, visible
  keyboard focus, clean console/runtime, and no horizontal overflow at 1280×900,
  768×1024, or 390×844.

### Self-review and revisions

- Replaced the old Video Producer label during storyboard loading/ready states
  with the explicit Storyboard Agent identity and agent-specific errors.
- Added a browser assertion that proves the persisted scenes came from the API,
  rather than merely checking the same scene count as the mock.
- Reduced public scene timing from three decimal places to one for a calmer,
  production-readable timeline while retaining an exact final target boundary.
- Made omitted scene counts adapt to short scripts up to the eight-scene default,
  instead of rejecting an otherwise valid brief.
- Adjusted one floating-point sum assertion to use a narrow tolerance; the public
  final scene boundary remains exactly the requested duration.

### Limitations

- Live provider validation was skipped because no LLM URL, key, model, or live
  topic was exported; the optional command made no paid request.
- Passed-review lookup and completed Storyboard caching are process-local. A
  backend restart requires a fresh review before Storyboard generation.
- Search queries and visual direction are proposals only. CreatorPilot does not
  fetch, verify, license, or clear media and does not validate factual claims.
- Automated contrast measurement is unavailable. Existing visual tokens were
  unchanged and the refreshed board was reviewed visually.
