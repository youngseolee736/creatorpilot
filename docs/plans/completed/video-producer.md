# Phase 6 Video Producer Plan

## Desired outcome

CreatorPilot can submit a server-verified production package to a configured
render provider, return an idempotent asynchronous render job, poll normalized
progress, and expose provider delivery URLs on completion. It never converts an
unconfigured provider, stale approval, modified storyboard, or failed job into a
successful mock result.

## Completion evidence

- `POST /api/videos/render` resolves the passed review and exact stored
  Storyboard before invoking a provider.
- `GET /api/videos/:renderId/status` returns normalized queued, running,
  completed, and failed states and stops provider polling after a terminal state.
- Identical render starts reuse the same in-process job and never create duplicate
  provider jobs.
- Provider configuration, authentication, rate limit, timeout, malformed output,
  timeline, and authorization failures are covered by backend tests.
- Video API mode displays provider progress and delivery links while retaining a
  clearly distinct mock fallback.
- The browser fixture completes the entire API-backed workflow through provider
  render completion without console, accessibility, or responsive regressions.

## Journey and states

1. The creator approves the server-generated Storyboard and production settings.
2. The backend resolves the passed review and exact Storyboard record, validates
   its gap-free timeline, and builds the provider package.
3. The configured provider receives one idempotent render submission.
4. The frontend polls CreatorPilot, which normalizes provider progress and
   terminal failures without exposing credentials or raw diagnostics.
5. Completion exposes signed video and production-package URLs; mock mode retains
   the existing local poster and JSON demonstration.

## Implementation

- Add Storyboard registry lookup by review ID and exact scene array.
- Add Video Producer input validation, job orchestration, status normalization,
  in-process idempotency, and terminal-state caching.
- Add a configurable server-side HTTP render provider with safe URL,
  authentication, timeout, and error handling.
- Add video start/status routes and injectable application wiring.
- Connect frontend configuration, provider-aware progress/delivery UI, fixture,
  and tests to API video mode.
- Update setup, API, handoff, project scope, and agent-contract documentation.

## Self-review checklist

- Confirm stale review IDs and any modified scene field fail before provider use.
- Confirm provider credentials and raw error bodies never reach the browser.
- Confirm retries cannot create duplicate render jobs.
- Confirm completed and failed jobs are terminal and no longer poll the provider.
- Confirm provider output is not described as mock media and mock output is never
  described as a real render.
- Confirm loading, progress, failure, completion, delivery links, refresh,
  accessibility, and responsive behavior.

## Scope notes

This phase implements the orchestration and generic provider boundary, not a
vendor-specific contract, asset marketplace, stock licensing system, or cloud
project database. A deployment must configure an adapter-compatible render API
before real media can be generated. Existing CreatorPilot design references
remain applicable; no new page or navigation design is required.

## Completion report

Completed on 2026-07-19.

- Added the authorized Video Producer, strict production-package validation,
  normalized terminal states, in-process idempotency, and terminal caching.
- Added the generic authenticated HTTP render adapter and safe provider error,
  timeout, response, and delivery-URL handling.
- Connected API start/poll behavior and provider-specific progress and delivery
  UI while retaining the clearly labeled mock flow.
- Added 15 backend Video Producer tests and expanded frontend coverage to 22
  tests. The full backend suite passes 110 tests.
- Ran the complete six-service browser fixture through provider completion at
  desktop, tablet, and mobile widths with clean accessibility and console checks.
- The optional live-render command correctly skips without explicit paid
  provider credentials; no external render was started during validation.
