# CreatorPilot Project Specification

## Product context

CreatorPilot turns three to five reference YouTube videos and a new topic into an original
60-second vertical-video storyboard plan. It visualizes the work of a Script
Analyst, Research Agent, Scriptwriter, and Storyboard Agent
without presenting those agents as a chatbot.

## Primary journey

1. Add three required YouTube references, up to two optional references, a topic,
   language, duration, format, and Standard or Deep analysis depth.
2. Extract and analyze each reference independently, then synthesize their
   storytelling structures without combining raw transcript text.
3. Research the user's tailored angle and review a source-grounded Fact Pack.
4. Generate and edit an original script constrained to that Fact Pack.
5. Generate a polished Storyboard Preview showing each scene's timing,
   narration, visual direction, optional AI image preview, caption, transition,
   and suggested B-roll query.

Users must always know which agent is active, what has completed, what is waiting,
whether revision is required, and what action advances the production.

## MVP scope

- Professional creator dashboard and project empty state.
- Backend-mediated public YouTube transcript extraction with mock fallback.
- Configurable real Script Analyst, Research Agent, Scriptwriter, and
  Storyboard services with independent server-side provider configuration and
  per-service mock fallback.
- One complete, navigable mock production workflow.
- Editable generated script and persistent browser-local project state.
- Server-validated seven-to-ten-scene Storyboard Preview with AI image prompts,
  optional generated still previews, and a mock fallback.
- Responsive, accessible HTML, CSS, and native JavaScript modules.
- Async service interfaces ready to replace with future backend adapters.
- Optional project-wide Deep mode with two validated candidates and a final
  Judge in reference synthesis and Scriptwriter; Research stays lightweight so
  it does not bottleneck the demo workflow.

## Out of scope

- Automated factual guarantees, stock-footage search/licensing, a vendor-specific
  render implementation, authentication, payments, and cloud persistence.
- Copyright clearance or legal guarantees.
- Copying wording, branding, graphics, or full layouts from reference products.

## Technical direction

- The frontend introduces no framework or runtime dependency; the Phase 1 backend
  uses Express as its isolated integration layer.
- Hash routes provide refresh-safe navigation on the existing static server.
- Project data is stored in versioned local storage for the prototype.
- Transcript extraction, analysis, script generation/revision, storyboarding,
  and optional still-image previews can use the Express API. Full MP4 media
  rendering is intentionally out of scope for the project prototype.
- Deep-role providers are independently configurable server-side and safely
  fall back to each stage's primary provider when role overrides are absent.
- UI meaning never relies on color alone; focus, keyboard flow, and status text are
  required.
