# CreatorPilot Project Specification

## Product context

CreatorPilot turns a reference YouTube video and a new topic into an original
60-second vertical-video production plan. It visualizes the work of a Script
Analyst, Scriptwriter, Originality Reviewer, Storyboard Agent, and Video Producer
without presenting those agents as a chatbot.

## Primary journey

1. Add a YouTube reference, topic, language, duration, and format.
2. Extract and analyze the reference transcript and storytelling structure.
3. Generate and edit an original script.
4. Review potential phrase overlap, clarity, duration, hook, and structure.
5. Approve a storyboard and either submit it to a configured render provider or
   render a clearly labeled mock result.

Users must always know which agent is active, what has completed, what is waiting,
whether revision is required, and what action advances the production.

## MVP scope

- Professional creator dashboard and project empty state.
- Backend-mediated public YouTube transcript extraction with mock fallback.
- Configurable real Script Analyst, Scriptwriter, Originality Reviewer, and
  Storyboard services with independent server-side provider configuration and
  per-service mock fallback.
- One complete, navigable mock production workflow.
- Editable generated script and persistent browser-local project state.
- Originality estimate with careful non-legal language.
- Server-validated seven-to-ten-scene storyboard and provider-aware rendering
  lifecycle with a mock fallback.
- Responsive, accessible HTML, CSS, and native JavaScript modules.
- Async service interfaces ready to replace with future backend adapters.

## Out of scope

- Research/fact retrieval, stock-footage search/licensing, a vendor-specific
  render implementation, authentication, payments, and cloud persistence.
- Copyright clearance or legal guarantees.
- Copying wording, branding, graphics, or full layouts from reference products.

## Technical direction

- The frontend introduces no framework or runtime dependency; the Phase 1 backend
  uses Express as its isolated integration layer.
- Hash routes provide refresh-safe navigation on the existing static server.
- Project data is stored in versioned local storage for the prototype.
- Transcript extraction, analysis, script generation/revision, originality
  review, storyboarding, and rendering orchestration can use the Express API;
  actual media generation requires an adapter-compatible provider.
- UI meaning never relies on color alone; focus, keyboard flow, and status text are
  required.
