# Narrative DNA Analysis

## Desired outcome

CreatorPilot should explain how a reference video creates and sustains viewer
interest before it writes a new script. The analysis must focus on reusable
spoken-narrative mechanics rather than the reference topic or wording.

## Evidence of completion

- The Script Analyst returns a validated, timestamp-grounded Narrative DNA
  contract.
- The analysis page presents hook mechanics, narrative style, information flow,
  retention devices, emotional movement, and the intended viewer experience.
- Existing downstream agents continue to receive a compact abstract blueprint
  without the reference transcript.
- Mock and API paths pass their automated tests.
- The analysis page is inspected at desktop, tablet, and mobile widths with no
  console errors in the core flow.

## User journey

1. The creator submits one reference video and a new topic.
2. CreatorPilot extracts the transcript with timestamps.
3. The Script Analyst identifies the video's reusable experience mechanics.
4. The creator reviews the Narrative DNA and its timing evidence.
5. The creator advances to research and later script generation.

## Implementation

- [x] Extend and validate the Script Analyst output contract.
- [x] Update the analysis and repair prompts.
- [x] Add deterministic mock Narrative DNA data.
- [x] Pass the strongest mechanics into the compact reference blueprint.
- [x] Present the new analysis fields in the existing analysis page.
- [x] Add backend and frontend test coverage.
- [x] Run automated tests and inspect responsive browser states.
- [x] Complete a self-review and record revisions.

## Design evidence

This localized extension reuses the current references in
`docs/DESIGN_REFERENCES.md`, reviewed on 2026-07-18:

- YouTube Studio: compact creator-oriented status and next-action patterns.
- Descript: document-like analysis and explicit semantic sections.
- Frame.io: evidence tied to a reviewable production decision.

The implementation adapts those patterns inside CreatorPilot's existing visual
system. It does not copy branding, layouts, icons, terminology, or proprietary
interaction patterns.

## Validation and self-review

- `npm test`: 126 backend and agent tests passed.
- `node frontend/tests/creatorpilot.test.mjs`: 29 frontend tests passed.
- Full API-backed browser workflow passed with the fixture backend.
- Browser inspection covered 1280×900, 768×1024, and 390×844.
- Narrative DNA and final-result screens had no horizontal overflow.
- The core workflow had no browser console or runtime errors.
- Visible controls had accessible names, route focus was restored, and keyboard
  focus remained visible. New content uses semantic sections, headings, lists,
  and definition lists and introduces no new interactive controls.
- Manual contrast judgment reused existing tested text and accent tokens; no
  automated contrast tool is configured in the repository.

Self-review found that the new contract could have become an isolated analysis
artifact. The compact blueprint was revised to carry the narrative engine,
information pattern, viewer journey, and timestamp-derived retention functions
into script generation. The responsive review confirmed that the dense desktop
layout needed a single-column mobile presentation; the journey, DNA articles,
and emotional arc were stacked at the existing mobile breakpoint. Raw transcript
content remains available only behind the existing disclosure.

Follow-up revision on 2026-07-22 separated the English analyst workspace from
the project's target script language, constrained Narrative DNA prose and list
counts, removed duplicate summary panels, and placed timing evidence behind a
native collapsed disclosure. The final script still follows the creator's
selected target language.

A second follow-up removed the technical Narrative DNA presentation. The final
screen now exposes only a one-sentence story summary, a five-step flow, three
story decisions (Opening, Build, Payoff), and two or three reusable instructions.
User-facing timelines, emotional-arc charts, retention terminology, confidence
labels, and category-heavy summaries were removed. Timing remains internal
validation data only.

The final readability pass used Subscribr's progressive-disclosure pattern as a
reference without reproducing its interface. It enforces an 18-word maximum for
the leading story sentence, reduces its display size, keeps secondary evidence
collapsed, and removes the duplicate sticky action bar that obscured the story
cards. The single next-step action remains in the page header.

A topic-application pass adds one concrete example beneath each story decision.
The examples use the customer's current topic for Opening, Build, and Payoff,
while explicitly avoiding invented facts before the Research Agent runs. The
three decisions stack vertically so the applied examples remain readable at
desktop and mobile widths.

The retry path now clears incomplete cached analysis data before requesting a
fresh result. The analysis renderer also treats every list as untrusted stored
data, so a partial or legacy result cannot crash the page while migration runs.

The final screen remains visually distant from all documented references: it
uses CreatorPilot's existing editorial typography, neutral work surface, and
orange/teal status system, and does not reproduce YouTube Studio, Descript, or
Frame.io branding, layout, terminology, or proprietary controls.

## Changed files

- Script Analyst contract and prompts:
  `backend/src/agents/script-analyst/normalize-analysis.js`,
  `backend/src/agents/script-analyst/script-analyst-prompt.js`
- Downstream blueprint use:
  `backend/src/contracts/creative-input.js`,
  `backend/src/agents/scriptwriter/scriptwriter-prompt.js`, `frontend/core.mjs`
- Analysis presentation and mock data:
  `frontend/pages/analysis.mjs`, `frontend/styles.css`,
  `frontend/components.mjs`, `frontend/mock-services.mjs`
- Automated checks and browser fixture:
  `backend/tests/analysis-tests.js`, `backend/tests/browser-fixture-server.js`,
  `frontend/tests/creatorpilot.test.mjs`, `frontend/tests/browser-cdp.py`
- Contracts and handoff documentation:
  `docs/AGENT_DATA_CONTRACTS.md`, `docs/BACKEND_API_CONTRACT.md`,
  `docs/BACKEND_HANDOFF.md`
