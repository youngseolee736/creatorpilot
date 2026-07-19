# CreatorPilot Project Specification

## Product context

CreatorPilot turns a reference YouTube video and a new topic into an original
60-second vertical-video production plan. It visualizes the work of a Script
Analyst, Scriptwriter, Originality Reviewer, and Video Producer without presenting
those agents as a chatbot.

## Primary journey

1. Add a YouTube reference, topic, language, duration, and format.
2. Extract and analyze the reference transcript and storytelling structure.
3. Generate and edit an original script.
4. Review potential phrase overlap, clarity, duration, hook, and structure.
5. Approve a storyboard and render a clearly labeled mock video result.

Users must always know which agent is active, what has completed, what is waiting,
whether revision is required, and what action advances the production.

## MVP scope

- Professional creator dashboard and project empty state.
- Backend-mediated public YouTube transcript extraction with mock fallback.
- Configurable real Script Analyst and Scriptwriter services with per-service
  mock fallback.
- One complete, navigable mock production workflow.
- Editable generated script and persistent browser-local project state.
- Originality estimate with careful non-legal language.
- Seven-to-ten-scene storyboard and mock rendering lifecycle.
- Responsive, accessible HTML, CSS, and native JavaScript modules.
- Async service interfaces ready to replace with future backend adapters.

## Out of scope

- Real originality review, research/fact retrieval, stock-footage search,
  narration, rendering, export, authentication, payments, and cloud persistence.
- Copyright clearance or legal guarantees.
- Copying wording, branding, graphics, or full layouts from reference products.

## Technical direction

- The frontend introduces no framework or runtime dependency; the Phase 1 backend
  uses Express as its isolated integration layer.
- Hash routes provide refresh-safe navigation on the existing static server.
- Project data is stored in versioned local storage for the prototype.
- Transcript extraction, analysis, and script generation/revision can use the
  Express API; later services remain asynchronous mocks with retryable errors.
- UI meaning never relies on color alone; focus, keyboard flow, and status text are
  required.
