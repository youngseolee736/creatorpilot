# RelocateAI Landing Page and Relocation Intake Plan

**Status:** Implemented and validated after approval  
**Created:** 2026-07-17  
**Scope:** First frontend task only; no backend calculation changes

## Desired result

A first-time U.S. resident can arrive at RelocateAI, understand within seconds
what the product estimates and why it is useful, begin a relocation plan without
financial expertise, complete a focused intake, review the information that will
be entered or estimated, and submit confidently.

The finished experience should feel like a calm planning worksheet elevated into
a polished consumer product. It should not resemble an enterprise dashboard, a
housing marketplace, a generic chatbot, or a decorative AI landing page.

This first task covers the landing page, guided intake, answer review, and the
loading/success/error boundary around estimate submission. It does not authorize
new financial calculations or a full results experience unless separately
approved.

## Desired user outcome

- Understand the four outputs: initial moving costs, monthly living costs,
  total-stay costs, and recommended emergency savings.
- Know that RelocateAI combines user-entered values with clearly labeled
  estimates rather than claiming perfect accuracy.
- Start with information the user already knows: destination, timing, and
  household.
- Complete the intake without encountering unexplained financial terminology.
- Use “not sure” or estimated-value options where exact information is reasonably
  unavailable.
- Review and change answers before requesting an estimate.
- Retain entered information after validation or API errors.

## Desired visual and emotional impression

- Calm, credible, practical, and specific to relocation planning.
- Warm rather than institutional, but restrained rather than playful.
- Financially trustworthy without resembling a bank, lender, or crypto product.
- Spacious and intentionally hierarchical without becoming a collection of
  rounded cards.
- Helpful to users working in a second language through short sentences, explicit
  labels, and predictable interaction.

Preliminary visual ingredients:

- Warm neutral background and high-contrast ink text.
- One controlled blue-green accent family, subject to approval.
- Semantic treatments for “You entered,” “RelocateAI estimate,” “Needs review,”
  warning, error, and success that do not rely on color alone.
- Strong typographic scale, dividers, spacing, and alignment as the main hierarchy
  tools; limited shadows and no ornamental gradients.
- A simple cost-timeline motif—before moving, each month, whole stay, and safety
  buffer—rather than a generic dashboard grid.

## Current frontend problems

- `frontend/` is completely empty.
- There is no HTML entry page, stylesheet, JavaScript, component structure, or
  asset strategy.
- There is no framework or package manifest.
- There are no run, build, lint, formatting, or frontend test commands.
- There is no current navigation or information architecture to preserve.
- There is no backend API implementation or documented request/response contract.
- There is no approved visual identity beyond the preliminary design direction in
  `docs/DESIGN_REFERENCES.md`.
- There is no browser-renderable frontend to validate yet.

## Information the user must understand immediately

The first viewport should answer:

1. **What is this?** A relocation-cost planning tool for moving to the U.S.
2. **What will I get?** Initial, monthly, total-stay, and emergency-savings
   estimates.
3. **What do I need to begin?** Destination, approximate timing, and household.
4. **Can I trust the numbers?** Entered and estimated values are labeled, and the
   result is a planning estimate rather than legal or financial advice.
5. **What happens next?** A short guided intake followed by a review before any
   estimate request.

## Primary action

**Primary CTA:** “Plan my move”

The CTA should begin the intake and move keyboard focus to its first heading. It
must not require account creation, imply guaranteed accuracy, or suggest that a
booking or financial transaction will occur.

A secondary text action may explain “What the estimate includes,” but it must not
compete visually with the primary action.

## Complete user journey

1. **Arrive on the landing page.** Read a specific outcome-focused headline and
   see a compact, clearly fictional estimate preview demonstrating the four
   outputs and source labels.
2. **Understand the process.** Scan what is included, how values are sourced, and
   the three-step process: tell us about the move, review assumptions, receive a
   planning estimate.
3. **Start the intake.** Activate “Plan my move.” The landing context remains
   available through a brand/home link without losing saved answers.
4. **Move context.** Enter a U.S. destination, an exact date or approximate
   timeframe, and expected stay duration.
5. **Household context.** Select student, intern, young professional, or another
   applicable situation; provide household size and relevant dependents.
6. **Housing context.** Choose a housing type and whether rent or deposits are
   known. Allow exact user values or a clearly labeled “estimate this for me.”
7. **Transportation context.** Choose likely local transportation and optionally
   enter known travel or vehicle costs.
8. **Lifestyle and known costs.** Collect only values needed by the future API;
   separate required questions from optional adjustments and custom known costs.
9. **Review answers.** Group answers by move, household, housing, transportation,
   and known costs. Mark each as “You entered” or “RelocateAI will estimate,” and
   provide accessible, context-specific change actions.
10. **Submit.** Show a non-blocking loading state while preventing duplicate
    submission.
11. **Success boundary.** If an estimate response exists, confirm completion and
    hand off to the separately scoped results presentation. If the backend is not
    yet available, use only an explicitly approved demo response and label it as
    demo data.
12. **Recover from failure.** Preserve all answers, explain the API or network
    problem in plain language, focus the message, and allow retry without
    restarting.

## Evidence that the design is successful

- A new visitor can identify the four outputs and primary action from the first
  viewport without opening secondary content.
- The intake begins with destination, timing, and household rather than a long
  undifferentiated form.
- Every cost field or review value indicates whether it was entered by the user or
  will be estimated.
- All intake steps support forward and backward movement without losing state.
- Validation errors retain values and provide a specific correction path.
- The core flow works with keyboard-only input and visible focus.
- The layout remains coherent at approximately 1280px, 768px, and 390px viewport
  widths without horizontal overflow.
- Browser testing shows no uncaught console errors in the primary flow.
- A self-review compares the result with the five documented references and
  records at least one revision made because of the review.
- The implemented result avoids every rejected pattern documented in
  `docs/DESIGN_REFERENCES.md`.

## Reference patterns that will be adapted

- **Localyze:** Adapt a domain-specific problem statement paired with visible
  product evidence. Replace enterprise case-management framing with a personal
  estimate preview and cost timeline.
- **Wise:** Adapt the close relationship among inputs, outcome, breakdown,
  assumptions, and warnings. Do not adapt its brand palette, transaction UI, or
  chat overlay.
- **Airbnb:** Adapt the semantic starting sequence of where, when, and who, plus
  flexible timing. Do not imitate its search pill, marketplace navigation, or
  listing imagery.
- **Zillow:** Adapt the basic-versus-advanced input hierarchy, result-first
  summary, and editable assumptions. Do not adapt mortgage qualification,
  lead-generation, or slider-only controls.
- **GOV.UK Design System:** Adapt focused questions, reliable back navigation,
  retained values, specific validation recovery, and a check-answers step. Do not
  copy its brand or exact visual system.

## Original RelocateAI-specific design decisions

- **Four-part cost timeline:** Organize the product promise around “Before you
  move,” “Each month,” “Your whole stay,” and “Safety buffer.” This explains the
  relationship among totals without presenting four disconnected cards.
- **Source labels:** Every relevant value receives a text label: “You entered,”
  “RelocateAI estimate,” or “Needs review.” Icons and color may reinforce but not
  replace the text.
- **Move brief:** Maintain a compact summary of destination, timing, household,
  and current intake stage. It becomes a desktop side rail and a collapsible
  summary on smaller screens.
- **Certainty-aware timing:** Let users choose an exact date, a target month, or
  “I’m not sure yet,” because first-time movers often plan before dates are fixed.
- **Estimate-for-me choice:** For appropriate cost inputs, users explicitly choose
  between entering a known amount and asking RelocateAI to estimate it.
- **No chatbot framing:** The guided intake uses familiar form controls and plain
  explanatory copy rather than a simulated conversation.
- **No decorative relocation cliché:** Avoid planes tracing dotted paths, passport
  stamp collages, flags as decoration, and stock photos of people carrying boxes.

## Required sections and components

### Landing page

- Skip link and semantic page landmarks.
- Restrained header with RelocateAI wordmark, one optional explanatory anchor, and
  the primary CTA. No full navigation system until approved.
- Hero with outcome-focused copy, trust clarification, CTA, and estimate preview.
- Four-part cost timeline.
- “How the estimate works” three-step explanation.
- Entered-versus-estimated value explanation.
- Audience relevance section for students, interns, young professionals, and
  first-time residents without separate card duplication.
- Scope and limitation note: planning estimate, not legal or financial advice.
- Final CTA and minimal footer.

### Intake

- Intake shell with page title, back control, and simple progress text.
- Focused question groups for move, household, housing, transportation, and known
  costs.
- Move brief summary.
- Semantic labels, fieldsets, legends, hints, and optional markers.
- “Known amount” versus “Estimate this” control where appropriate.
- Review screen with grouped answers and contextual change links.
- Error summary and field-level error messages.
- Submission/loading control and retryable API message.

### Result boundary

- Success confirmation or API-provided handoff target.
- Explicit demo label if a non-production fixture is approved.
- No new financial calculation logic in frontend code.

## Required interface states

- Landing page default state.
- Landing CTA focus/hover/active states.
- Intake empty state before the first answer.
- Partially completed intake with preserved values.
- Exact-date, approximate-date, and unknown-date variants.
- Known-cost and “estimate this” variants.
- Optional field skipped state.
- Step-level validation error with retained answers.
- Review state showing entered versus estimated values.
- Change-answer return state.
- Submission loading state with duplicate submission prevented.
- Successful submission or approved demo-success state.
- API validation error mapped to the relevant field or section.
- General API/server error with retry.
- Offline/network error with retry.
- JavaScript-unavailable baseline message if the multi-step behavior requires it.

## Desktop layout

Target review width: approximately **1280px**.

- Landing content uses a centered maximum-width container with a two-column hero:
  promise and CTA on the left, estimate preview on the right.
- The cost timeline reads horizontally but remains one connected structure rather
  than four floating cards.
- Intake uses a content column wide enough for comfortable forms and a narrower,
  sticky move-brief rail.
- Form line length remains limited; financial inputs do not stretch across the
  full viewport.
- Review groups use aligned term/value/action rows with accessible change links.

## Tablet layout

Target review width: approximately **768px**.

- Hero columns stack or use a compact asymmetric layout depending on content fit.
- The cost timeline may become a two-by-two connected sequence or vertical flow.
- The move brief becomes a non-sticky summary above the active questions.
- Navigation remains minimal and avoids a new menu unless content requires it.
- Touch targets and inter-field spacing increase without making the page feel like
  a stack of oversized cards.

## Mobile layout

Target review width: approximately **390px**.

- Hero, preview, and intake are single-column.
- Primary actions use available width without becoming permanently sticky unless
  browser testing proves that behavior useful.
- The cost timeline becomes a vertical sequence with clear connecting rules.
- The move brief is collapsed to one summary row and can be expanded with a
  semantic button.
- Each focused question uses native or keyboard-safe controls with at least 44px
  touch targets where practical.
- Review rows stack labels, values, source labels, and change actions without
  horizontal scrolling.

## Accessibility requirements

- Semantic `header`, `nav` only if navigation exists, `main`, `section`, `form`,
  and `footer` landmarks.
- One descriptive page-level `h1` per state or view and logical heading order.
- A skip link and programmatic focus movement when the intake state changes.
- Native controls preferred; every control has a visible label and accessible
  name.
- Related choices use `fieldset` and `legend`.
- Optional fields are identified in text; required status is not communicated by
  color or an asterisk alone.
- Visible focus with adequate contrast across all interactive elements.
- Text and essential UI contrast meet WCAG 2.2 AA targets.
- Core flow is completable using keyboard only with logical focus order.
- Status, loading, validation, and API messages are announced appropriately; do
  not overuse live regions.
- Validation retains values, places a linked summary before the form, focuses the
  summary, and repeats specific messages at affected fields.
- Motion respects `prefers-reduced-motion`; no required information depends on
  animation.
- Currency inputs include explicit units and do not rely on placeholder text.
- Inputs use appropriate autocomplete and input modes only where semantically
  correct.

## Files expected to change

The repository is currently empty of application files. Expected implementation
scope, subject to approval:

- `frontend/index.html` — semantic landing, intake, review, and status markup.
- `frontend/styles.css` — tokens, responsive layout, component states, and print or
  reduced-motion rules if relevant.
- `frontend/app.js` — intake state, validation presentation, answer review, focus
  management, persistence during the session, and API adapter.
- `frontend/assets/` — only original or appropriately licensed assets if a real
  need emerges; the current plan does not require imagery.
- `frontend/tests/` — framework-free tests only if an existing or approved test
  runner is available; otherwise this remains an unresolved tooling decision.
- `README.md` — local run and validation instructions after the frontend exists.
- `docs/plans/active/relocation-intake.md` — execution notes, self-review findings,
  and completion evidence during implementation.

No backend files, financial calculation files, database files, authentication,
secrets, or deployment settings are expected to change.

## API assumptions

There is currently no backend implementation or API contract. The plan therefore
assumes, but does not define as authoritative:

- A future FastAPI endpoint accepts one structured relocation-intake request.
- The server remains authoritative for validation, estimates, cost data, scenario
  calculations, and emergency-savings recommendations.
- The frontend sends raw user inputs and explicit “estimate this” choices; it does
  not reproduce financial formulas.
- A successful response will eventually include the four totals, itemized
  categories, source metadata, assumptions, and scenario data where available.
- Validation errors can be associated with stable field identifiers.
- General failures include a safe user-facing message and a request or trace ID
  when available; no secret or stack trace is rendered.
- Authentication is not assumed for the first public intake unless separately
  specified.
- A local demo fixture may be used only with approval and must be visibly labeled
  as demo data. It must not be presented as a calculated estimate.

Before API integration, the request and response schema must be confirmed with
the backend owner. Any discrepancy is documented rather than solved by changing
backend behavior.

## Implementation sequence

1. Obtain approval for the decisions listed under “Risks and unresolved
   questions.”
2. Confirm whether the first task ends at review/submission or includes a real
   results response.
3. Confirm the API contract or approve a clearly labeled demo adapter.
4. Create semantic HTML for the landing hierarchy and no-JavaScript baseline.
5. Establish restrained design tokens and implement the responsive landing page.
6. Build the intake state model and focused question groups without calculations.
7. Add answer persistence, back/change behavior, review, and source labels.
8. Add validation, loading, success, API-error, and network-error presentation.
9. Connect the approved API adapter or demo fixture without backend changes.
10. Complete responsive refinement at desktop, tablet, and mobile widths.
11. Complete keyboard, focus, contrast, semantics, and reduced-motion checks.
12. Run available tests and inspect the full flow in a browser and console.
13. Perform an explicit self-review against the desired result and references.
14. Revise observed weaknesses and repeat affected validation.
15. Record files changed, commands run, browser evidence, limitations, and move
    the plan to `docs/plans/completed/` only after genuine completion.

## Browser testing plan

Test in a local server context rather than opening `index.html` directly.

### Viewports

- Desktop: approximately 1280px wide.
- Tablet: approximately 768px wide.
- Mobile: approximately 390px wide.
- At least one intermediate width to catch breakpoint-only layout problems.

### Flow checks

- Landing comprehension and CTA focus transition.
- Forward/back traversal through every intake group.
- Exact, approximate, and unknown move timing.
- User-entered and estimated-value choices.
- Review and contextual change actions.
- Empty required input and multiple validation errors.
- Loading, success, API validation error, server error, and offline error.
- Refresh/back-button behavior according to the approved state model.
- Long destination names, large currency values, and translated-length copy
  approximations.

### Quality checks

- No horizontal overflow or obscured content.
- No uncaught errors or unexplained warnings in the browser console.
- Keyboard-only completion, including error recovery and review changes.
- Visible focus and predictable focus movement after state transitions.
- Accessibility-tree spot check for labels, fieldsets, headings, and status text.
- Contrast check for text, controls, focus, source labels, and error states.
- Reduced-motion behavior.
- Screenshot comparison at the three target widths for self-review, not pixel
  imitation of references.

## Definition of done

- The five design references remain documented and their adapted patterns can be
  identified in the final rationale.
- The approved desired result and information architecture are implemented.
- Landing, intake, review, and approved submission boundary form one coherent
  journey.
- All relevant interface states listed in this plan are implemented.
- Entered and estimated values are distinguishable in text, not color alone.
- No frontend financial calculation substitutes for backend logic.
- Responsive review passes at approximately 1280px, 768px, and 390px.
- Keyboard, focus, semantics, labels, contrast, validation, and reduced-motion
  basics pass the documented checks.
- Relevant available tests and validation commands pass.
- Browser console review shows no uncaught errors in the core flow.
- One explicit self-review is documented, weaknesses are identified, and the
  implementation is revised before completion.
- Changed files, commands, browser checks, limitations, and unresolved risks are
  reported accurately.
- Any unavailable validation is disclosed; completion is not claimed if a
  required check could not be performed.

## Risks and unresolved questions

### Decisions requiring approval before implementation

1. **Information architecture:** Approve a single landing entry that transitions
   into a focused multi-step intake with a persistent move brief. This establishes
   the first core navigation and information architecture.
2. **Task boundary:** Decide whether this first implementation ends after review
   and successful submission, or must also include the complete estimate-results
   screen.
3. **Backend absence:** Approve either waiting for a real API contract or using a
   visibly labeled demo adapter and fixture for frontend-state testing.
4. **Initial visual direction:** Approve the warm-neutral, high-contrast,
   blue-green-accent direction and four-part cost timeline before it becomes the
   initial visual identity.
5. **State persistence:** Decide whether answers should survive only within the
   current page session, browser refresh through local storage, or not be stored
   until privacy expectations are defined.

### Additional risks

- Intake fields cannot be finalized responsibly until the backend request schema
  and actual calculation inputs are known.
- A static demo can validate interaction but cannot validate calculation accuracy,
  cost categories, or real API failure shapes.
- City autocomplete would require a data source or external service that is not
  currently approved.
- Local storage may retain potentially sensitive relocation and budget details;
  it should not be enabled by default without a privacy decision.
- Exact marketing claims and estimate-preview numbers could imply unsupported
  accuracy; examples must be clearly illustrative.
- Plain HTML, CSS, and JavaScript match the approved planned stack, but there is no
  existing test runner or build tool. Adding a major framework or UI library would
  require separate approval.
- The complete result hierarchy is documented in the product specification and
  design references, but implementing it may materially expand this first task.

The user approved this plan before implementation; the implementation notes below
record how those decisions were resolved for this task.

## Implementation notes

Implemented on 2026-07-17 after the user approved this plan.

- Built the approved single-page landing-to-intake journey in plain semantic
  HTML, CSS, and JavaScript; no framework or third-party dependency was added.
- Implemented the outcome-led hero, illustrative estimate preview, connected
  four-part cost timeline, process explanation, source-label guidance, audience
  context, limitations, and final CTA.
- Implemented six focused intake states covering move, household, housing,
  transportation, planning preferences, and review.
- Added exact-month-unknown timing choices, known-versus-estimated cost choices,
  in-memory answer retention, back/change navigation, contextual review actions,
  validation summary and field errors, loading, retryable API/offline errors, and
  a clearly labeled demo-success boundary.
- Kept the calculation boundary explicit: the demo adapter returns only move
  context and never produces financial totals.
- Added a dependency-free model test and a Chrome DevTools browser smoke test.
- Added local run, state-simulation, and check instructions to `README.md`.

The approved decisions were interpreted as: a single landing-to-intake
information architecture, completion at the submission boundary rather than a
financial results screen, a visibly labeled demo adapter, the documented warm
neutral/blue-green visual direction, and in-memory state only.

## Validation results

All of the following were actually run after the final revisions:

```text
node --input-type=module --check < frontend/app.js        PASS
node --check frontend/intake-model.mjs                    PASS
node frontend/tests/intake-model.test.mjs                 PASS (7/7)
python3 -m py_compile frontend/tests/browser-cdp.py       PASS
python3 frontend/tests/browser-cdp.py                     PASS
```

The browser test ran against a local HTTP server in Google Chrome 150. It
completed the primary flow from landing through review and demo success, checked
empty validation and error-summary focus, verified that answers survive simulated
API and offline failures, confirmed loading disables duplicate submission,
retried successfully, and confirmed the demo creates no financial totals. It
also found no browser console or runtime errors.

Chrome device emulation and captured visual evidence were reviewed at:

- 1280 × 900 desktop: landing and intake.
- 768 × 1024 tablet: landing and intake.
- 390 × 844 mobile: landing and intake.

All six responsive checks reported no horizontal overflow. Screenshots are under
`docs/plans/active/evidence/`. Keyboard testing confirmed the skip link is the
first Tab stop, focus is visible, the intake heading receives focus after the CTA,
and every dynamic form step exposes programmatic labels. An accessibility-tree
spot check found no unnamed visible button, textbox, radio, combobox, or
spinbutton.

## Explicit self-review and revisions

The implementation was compared with the documented Localyze, Wise, Airbnb,
Zillow, and GOV.UK patterns, using them for problem specificity, input-to-outcome
clarity, where/when/who sequencing, editable assumptions, and validation
recovery. Their brand treatments, marketplace UI, mortgage framing, search-pill
layout, and exact visual systems were not copied.

Weaknesses identified and resolved:

1. Chrome reported a missing-favicon 404 in an otherwise clean console. Added an
   original local SVG favicon and reran the full browser check with a clean
   console.
2. Review values initially placed source tags as invalid siblings of `dt` and
   `dd`. Nested the source label within the value definition and adjusted the
   responsive grid so the review remains valid, readable, and stacked on mobile.
3. Month, household, and dependent validation accepted finite positive decimals
   in the model even though the concepts require whole counts. Added explicit
   whole-number validation and a regression test.
4. The first accessibility smoke test inspected the landing accessibility tree
   but did not prove labels across every dynamic form step. Added label checks at
   move, household, housing, transportation, and planning steps, then reran the
   complete test.
5. macOS headless Chrome's direct 390px window screenshot cropped a wider minimum
   window and was not reliable evidence. Replaced it with DevTools device
   emulation captures at the exact target widths and visually reviewed the
   corrected landing and intake images.

## Remaining limitations

- There is no backend or API contract, so calculation accuracy, server-side
  validation mapping, real response rendering, and production network behavior
  cannot be tested. The adapter and illustrative landing figures are explicitly
  labeled as demo/example content.
- Browser automation and visual inspection were completed in Google Chrome only;
  Safari and Firefox were not available in this validation pass.
- Automated contrast tooling was not available. Colors were chosen for strong
  visual contrast and reviewed visually, but a formal WCAG contrast audit remains
  follow-up work.
- Browser refresh intentionally clears answers because privacy requirements for
  storing relocation and budget information are unresolved.
- City autocomplete, authentication, deployment, analytics, and the full estimate
  results experience remain outside this approved frontend task.
