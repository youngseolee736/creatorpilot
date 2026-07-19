# Phase 4 Originality Reviewer Agent Plan

## Desired outcome

CreatorPilot can compare the exact generated script with the reference transcript
and abstract analysis through a configured backend LLM provider, then return a
validated, conservative originality estimate and production-quality review. The
backend owns review identity, pass/fail thresholds, score bounds, overlap limits,
and the non-legal disclaimer.

## Completion evidence

- `POST /api/scripts/review` validates the reference, script, and optional
  thresholds and returns a stable review contract.
- Model output cannot set review IDs, script IDs, pass/fail status, thresholds,
  or legal claims.
- Malformed output receives at most one repair attempt; invalid inputs,
  configuration failures, provider failures, and retry behavior are tested.
- Per-service frontend configuration can run transcript, analysis, script, and
  review through the API while later production stages remain mocked.
- The browser fixture completes the API-backed journey through an originality
  review and revision loop without console, accessibility, or responsive-layout
  regressions.

## Journey and states

1. The creator saves an exact script draft and requests an originality check.
2. The Reviewer receives the normalized reference transcript, abstract analysis,
   exact script version, and server-normalized thresholds.
3. The review screen shows the backend-controlled verdict, scores, bounded phrase
   comparisons, revision guidance, and non-legal disclaimer.
4. Failed reviews can return guidance to the Scriptwriter; passed reviews can
   advance to the still-mocked production stages.
5. Retryable loading and API-error states continue to use the existing Reviewer
   pipeline UI.

## Implementation

- Add Reviewer request validation, prompts, output parsing/normalization,
  deterministic threshold enforcement, and in-process idempotency.
- Add the review route to the existing script router through injectable app
  wiring and agent-specific provider errors.
- Connect the existing per-service frontend selector and browser fixture to the
  real review endpoint without changing navigation or visual design.
- Add backend, frontend, live-check, and browser-fixture coverage.
- Update setup, API, handoff, project scope, and agent-contract documentation.

## Self-review checklist

- Confirm only the Reviewer receives the reference transcript and the prompt
  treats it and the script as untrusted content.
- Confirm exact script identity and version are preserved in the response.
- Confirm pass/fail is derived from server thresholds and validated risk values.
- Confirm excerpts are bounded and no unavailable review is converted to a pass.
- Confirm loading, success, failure, revision, retry, and refresh behavior remain
  understandable at 1280px, 768px, and 390px.

## Scope notes

This is a localized service integration, not a page redesign, navigation change,
or information-architecture change. Existing CreatorPilot design references and
the completed review UI remain applicable; no new external design research is
required. Storyboarding and rendering remain mocked.

## Completion report

### Outcome

- Added a real OpenAI-compatible Originality Reviewer endpoint with validated
  input, bounded exact phrase evidence, one repair attempt, and in-process
  idempotency.
- Kept review identity, script identity, weighted overall score, structure-risk
  bands, threshold enforcement, verdict, and non-legal disclaimer under backend
  control.
- Connected the existing review service selector and browser workflow to API
  mode while keeping storyboard and rendering mocked.

### Design evidence

- This was a localized service integration using the completed CreatorPilot
  review page and the references already recorded in `docs/DESIGN_REFERENCES.md`;
  no new page, layout, navigation, or visual identity was introduced.
- Browser screenshots were refreshed and the 1280px review screen was inspected.
  The existing explicit verdict, scorecard, phrase evidence, reviewer guidance,
  and approval boundary remained intact.

### Files changed

- Reviewer backend: `backend/src/agents/originality-reviewer/`,
  `backend/src/routes/scripts.js`, and `backend/src/app.js`.
- Tests and fixture: `backend/tests/originality-reviewer-tests.js`,
  `backend/tests/live-reviewer.js`, `backend/tests/browser-fixture-server.js`,
  `frontend/tests/creatorpilot.test.mjs`, and `frontend/tests/browser-cdp.py`.
- Frontend integration and review states: `frontend/config.js`,
  `frontend/components.mjs`, `frontend/pages/review.mjs`, and
  `frontend/styles.css`.
- Setup and contracts: `README.md`, `backend/package.json`,
  `docs/PROJECT_SPEC.md`, `docs/AGENT_DATA_CONTRACTS.md`,
  `docs/BACKEND_API_CONTRACT.md`, and `docs/BACKEND_HANDOFF.md`.
- Browser evidence: refreshed CreatorPilot screenshots under
  `docs/plans/completed/creatorpilot-evidence/`.

### Validation

- Backend: 24 transcript, 27 analysis, 16 Scriptwriter, and 13 Reviewer tests
  passed (80 total).
- Frontend: syntax checks, Python compilation, and 17 service/core/rendering
  tests passed.
- Dependency audit: 0 vulnerabilities across 76 packages.
- Browser: API transcript, analysis, initial script, revision, Reviewer review,
  Reviewer re-review, refresh persistence, and remaining mock production flow
  passed in a clean Chrome profile.
- Browser viewports: 1280×900, 768×1024, and 390×844 had no horizontal
  overflow. Visible controls had accessible names, keyboard focus was visible,
  route focus was correct, and the browser console/runtime were clean.

### Self-review and revisions

- The initial Reviewer fixture returned one phrase comparison while the existing
  browser contract expected two. Added a second exact, validated comparison and
  ensured both excerpts survive the revision loop.
- The existing risk badge always used the low-risk style. Added allowlisted low,
  medium, and high classes so visual emphasis matches the returned text without
  relying on color alone.
- The sidebar connection label omitted the API-backed Reviewer. Updated it to
  name all four connected Phase 4 services.
- Reviewer API errors initially inherited the Script Analyst label. Passed the
  correct agent label and added validation hints for invalid evidence and scores.

### Limitations

- Live provider validation was skipped because no LLM URL, key, model, or live
  topic was exported; the optional command exited safely without a paid request.
- Completed-review caching lasts only for the running backend process. Durable
  review persistence and cross-instance coordination remain future work.
- The Reviewer compares only the submitted reference and draft. It has no
  external plagiarism corpus, research source, factuality guarantee, copyright
  clearance capability, or legal authority.
- Automated contrast measurement is not available. Existing palette contrast was
  retained and reviewed visually; no color token was changed.
