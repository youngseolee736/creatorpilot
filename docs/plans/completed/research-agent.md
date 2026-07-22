# Research Agent implementation plan

Status: completed 2026-07-19

## Desired outcome

Insert a source-grounded Research Agent between Script Analyst and Scriptwriter.
The new stage turns the user's tailored creative brief and compact reference
blueprint into a reviewable Fact Pack, then constrains the Scriptwriter to that
approved material.

## Delivered

- Expanded project input with audience, angle, viewer goal, takeaway, tone,
  must-include, must-avoid, and CTA fields.
- Added `researcher` to project state, routing, service configuration, and the
  six-step agent pipeline.
- Added `POST /api/research/topic` using the OpenAI Responses API `web_search`
  tool with separate Research Agent configuration and a 120-second default
  research timeout.
- Rejects facts without at least one HTTPS citation found in provider-returned
  citation/source metadata.
- Added a responsive Fact Pack review screen with claim-level source links,
  confidence labels, open questions, and an explicit non-guarantee.
- Passes the creative brief, compact blueprint, and Fact Pack to initial
  Scriptwriter generation and revisions; the raw transcript remains prohibited.
- Compact Analyst structure is limited to three through six sections and always
  exposes Hook, Context, and Conclusion (Ending).
- Preserved the deterministic mock workflow and updated contracts, handoff
  documentation, environment examples, and the browser fixture.

## Verification

- Backend suite: 122 tests passed, including Research validation, source
  allowlisting, route behavior, and Scriptwriter Fact Pack propagation.
- Frontend suite: 27 tests passed, including research configuration, payload,
  clickable citations, storage migration, and routing.
- Live OpenAI web-search check: 6 facts and 16 provider-verified sources returned.
- Browser walkthrough: new project → analysis → research → script passed at
  1280×900, 820×1000, and 390×844 with no horizontal page overflow and no
  console errors. Three claim citations and seven generated script sections were
  present at every viewport.
- Evidence: `research-agent-desktop.png`, `research-agent-tablet.png`, and
  `research-agent-mobile.png` in this directory.
