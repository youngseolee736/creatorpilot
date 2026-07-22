# Deep pipeline ensemble

**Started:** 2026-07-23  
**Status:** Completed

## Desired outcome

The project-level `Deep analysis` choice continues through Research and
Scriptwriter. Each stage creates two independent, role-focused candidates and
uses a final Judge to return one contract-valid result. Standard mode keeps the
existing single-call path.

## Evidence of completion

- Research candidates independently test direct evidence and a transparent
  narrative case before a Research Judge produces one grounded Fact Pack.
- Script candidates independently prioritize persuasive storytelling and
  evidence clarity before a Writing Judge produces one full-duration script.
- Candidate and Judge failures degrade to a completed validated candidate.
- The selected mode is sent to both backend contracts and persists on reruns.
- Research and Scriptwriter pages show concise, collapsed comparison summaries.
- Tests cover Standard compatibility, Deep orchestration, failures, language,
  responsive layout, accessibility, and backward navigation.

## Design references

Reuse the progressive-disclosure pattern documented and reviewed in
`docs/plans/completed/deep-analysis-ensemble.md`: final work remains primary;
candidate comparison remains secondary and collapsed. No provider-specific
branding, hidden reasoning, or raw tool traces are exposed.

## Journey and states

1. Creator selects Deep analysis once during project setup.
2. Research runs a direct-evidence candidate and a narrative-case candidate in
   parallel; the Judge verifies and combines the strongest sourced result.
3. Scriptwriter runs a storytelling candidate and an evidence-clarity candidate
   in parallel; the Judge creates the final contract-valid narration.
4. Each completed page exposes `How the models compared` on demand.
5. If a role stops, the pipeline continues with the strongest validated result
   and clearly labels the degraded decision.

## Planned files

- `backend/src/agents/researcher/*`
- `backend/src/agents/scriptwriter/*`
- `backend/tests/researcher-tests.js`
- `backend/tests/scriptwriter-tests.js`
- `frontend/service-client.mjs`
- `frontend/mock-services.mjs`
- `frontend/app.js`
- `frontend/pages/research.mjs`
- `frontend/pages/script-editor.mjs`
- `frontend/styles.css`
- `frontend/tests/creatorpilot.test.mjs`
- `frontend/tests/browser-cdp.py`
- `backend/.env.example`
- `README.md`

## Validation and self-review

- Frontend suite: 42/42 passed.
- Backend suite: 155/155 passed, including Standard compatibility, parallel
  candidates, candidate failure, Judge failure, invalid modes, grounding, full
  duration, and revision lineage.
- Full API-fixture browser workflow passed. Deep comparisons render for Analyst,
  Research, and Scriptwriter; all completed stages remain navigable; desktop,
  tablet, and mobile have no horizontal overflow; visible controls have
  accessible names; browser console/runtime remained clean.
- Browser evidence is stored beside this plan in `deep-pipeline-evidence/`.
- Visual self-review confirmed the Research and Writing comparison rows remain
  secondary and collapsed while the verdict and editable script stay primary.
- Weakness: automated tests use deterministic providers and do not spend against
  external models. Production gets true model diversity only when the per-role
  model variables are configured; otherwise each role safely reuses its stage's
  primary provider.
