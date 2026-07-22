# Multi-reference analysis

**Started:** 2026-07-23  
**Status:** Complete

## Desired outcome

Creators add three required YouTube references and may add two more. CreatorPilot
keeps each reference independently inspectable, analyzes each video's storytelling
logic, and then synthesizes the strongest shared patterns and useful differences
into one original writing blueprint. Raw transcripts must never be concatenated
into one artificial source.

## Evidence of completion

- New-project intake accepts 3–5 unique, valid YouTube URLs and clearly marks the
  first three as required and the final two as optional.
- Each supplied reference has its own transcript, title, analysis, progress, and
  recoverable error state.
- A synthesis step produces one target-duration storytelling blueprint from the
  abstract analyses, not from copied source wording.
- Research, script generation, and originality review use the synthesized
  blueprint and the complete reference set.
- Existing single-reference local projects still open through a compatibility
  migration.
- Automated tests and browser checks cover success, validation, loading, error,
  desktop, tablet, mobile, keyboard, and console behavior.

## Design references

### 1. Google NotebookLM — add or discover new sources

- **URL:** <https://support.google.com/notebooklm/answer/16215270?hl=en>
- **Reviewed:** 2026-07-23
- **Observed:** The source workflow accepts multiple website URLs in one import
  action while retaining individual named sources for later selection.
- **Why selected:** It demonstrates how a synthesis product can accept a source
  set without erasing the identity of each source.
- **Adapted pattern:** CreatorPilot uses a clearly counted source set and preserves
  each reference as an independent analysis record.
- **Changed for CreatorPilot:** References are numbered 01–05, the minimum and
  optional slots are visible before submission, and the result focuses only on
  storytelling logic.
- **Must not copy:** Google branding, NotebookLM navigation, chat layout, source
  icons, or product copy.

### 2. YouTube Help — create and manage playlists

- **URL:** <https://support.google.com/youtube/answer/10232933?hl=en>
- **Reviewed:** 2026-07-23
- **Observed:** Videos can be added to an ordered collection and then managed as
  distinct items rather than merged into one asset.
- **Why selected:** CreatorPilot references are also an ordered video collection.
- **Adapted pattern:** Stable numbering communicates source order and makes each
  reference easy to identify during analysis.
- **Changed for CreatorPilot:** Ordering is used for reference identity only; it
  does not imply ranking or playback order.
- **Must not copy:** Playlist visuals, YouTube branding, thumbnails, playback
  controls, or management labels.

### 3. Adobe Express — add scenes to a video

- **URL:** <https://helpx.adobe.com/express/web/create-and-edit-videos/create-videos/add-scenes.html>
- **Reviewed:** 2026-07-23
- **Observed:** A video is represented as several individually selectable,
  editable scenes while still producing one coherent result.
- **Why selected:** The same part-to-whole relationship applies to several
  reference analyses feeding one synthesis.
- **Adapted pattern:** Individual references remain inspectable beneath a concise
  combined result.
- **Changed for CreatorPilot:** The items are evidence sources, not editable video
  scenes, and the hierarchy prioritizes synthesis before source detail.
- **Must not copy:** Adobe branding, editor timeline, scene thumbnails, toolbar,
  or editing interactions.

## User journey and interface states

1. The creator sees five numbered URL rows: three `Required`, two `Optional`.
2. Inline guidance states the allowed range and explains that sources are
   analyzed separately.
3. Submission rejects missing required URLs, invalid URLs, duplicates, and more
   than five entries with a focused inline error.
4. Reference intake shows progress as each transcript is saved.
5. Script analysis shows progress as each source is analyzed, followed by a
   synthesis state.
6. The completed view presents the combined story logic first and an expandable
   reference set second.
7. A failed source is named and retry preserves completed work.

## Data and service design

- Store `references[]`, with `referenceId`, `position`, `required`, `url`,
  `title`, `transcript`, and `analysis`.
- Preserve legacy top-level reference fields as read-compatible aliases during
  migration; new logic reads `references[]`.
- Extract and analyze each reference independently and persist after every
  successful request.
- Add a synthesis service that receives 3–5 abstract analyses and returns the
  existing story-analysis contract scaled to the user's target duration.
- Pass all reference analyses and transcripts to originality review while keeping
  the synthesized blueprint as the writer's structural input.

## Planned files

- `frontend/core.mjs`
- `frontend/pages/new-project.mjs`
- `frontend/pages/analysis.mjs`
- `frontend/app.js`
- `frontend/service-client.mjs`
- `frontend/mock-services.mjs`
- `frontend/styles.css`
- `frontend/tests/creatorpilot.test.mjs`
- `backend/src/agents/reference-synthesizer/*`
- `backend/src/routes/analysis.js`
- `backend/src/agents/originality-reviewer/*`
- related backend tests and product documentation

## Validation and self-review

### Automated validation

- `node frontend/tests/creatorpilot.test.mjs` — **36/36 passed**.
- `cd backend && npm test` — **143/143 passed** across transcript, analysis,
  research, writing, review, storyboard, and video suites.
- `git diff --check` — passed.
- Full Chrome DevTools workflow against the deterministic API fixture — passed
  from project intake through final render.

### Browser and accessibility validation

- Inspected the reference intake and analysis at 1280px, 768px, and 390px.
- Confirmed no horizontal overflow at desktop, tablet, or mobile sizes.
- Confirmed the three required-reference error is announced with `role="alert"`.
- Confirmed route focus, skip-link keyboard focus, visible focus styling,
  semantic labels, and accessible names for visible controls.
- Confirmed all three references remain separately visible after synthesis.
- Browser console and runtime error collections were empty.
- Evidence is stored in `docs/plans/completed/multi-reference-evidence/`.
- Text contrast was reviewed visually against the existing approved palette; no
  automated contrast tool is installed in this repository.

### Self-review and revisions

1. **Weakness:** Five sequential model calls could multiply the wait time.
   **Revision:** Transcript and per-reference analysis requests now run in
   parallel, successful partial results are saved, and synthesis runs only after
   the complete selected set is ready.
2. **Weakness:** The old 30-second Script Analyst provider deadline remained too
   short for long transcripts and synthesis. **Revision:** The unscoped default
   is now five minutes while an explicit Analyst timeout still wins.
3. **Weakness:** Comparing URL strings allowed the same YouTube video with a
   different query string. **Revision:** Validation now compares canonical video
   IDs and rejects duplicate videos.
4. **Weakness:** Source detail could make the synthesis hard to scan.
   **Revision:** The combined story logic remains primary; the numbered source
   set and transcripts are compact, secondary disclosures.
5. **Weakness:** Required/optional labels compressed poorly on narrow screens.
   **Revision:** Mobile rows stack their metadata above the URL field and retain
   explicit text labels.
6. **Weakness:** Analysis and editorial guidance ignored the selected target
   language. **Revision:** Korean now produces Korean analysis, research, script,
   review guidance, and captions; English remains English. Production search and
   shot directions remain English for tool interoperability.

### Reference-distance review

- NotebookLM's independent-source concept was adapted, but CreatorPilot uses a
  numbered editorial form and non-chat analysis page.
- YouTube's collection model was adapted, but no playlist visuals, thumbnails,
  controls, or branding are present.
- Adobe Express's independently inspectable items were adapted, but no editor,
  timeline, scene cards, or Adobe visual language are present.

### Delivered files

- Frontend state, orchestration, services, mocks, intake, analysis, dashboard,
  styles, and tests under `frontend/`.
- Script Analyst synthesis and multi-source Originality Reviewer support under
  `backend/src/`, with backend coverage under `backend/tests/`.
- Updated product scope in `docs/PROJECT_SPEC.md`.

### Limitations

- The browser workflow uses deterministic API providers; live LLM synthesis and
  three live YouTube caption sources were not invoked to avoid external cost and
  availability variance.
- Parallel analysis reduces elapsed time but may encounter provider-specific
  concurrency limits. Completed per-reference work is retained for retry.
