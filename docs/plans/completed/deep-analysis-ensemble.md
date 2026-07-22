# Deep analysis ensemble

**Started:** 2026-07-23  
**Status:** Completed

## Desired outcome

Creators can choose a fast Standard analysis or an optional Deep analysis. Deep
analysis creates two independent storytelling blueprints with different
editorial priorities, then asks a Judge to integrate the strongest hook, flow,
retention logic, applicability, and originality safeguards into one result.

## Evidence of completion

- New-project intake clearly explains Standard versus Deep analysis.
- The selected mode persists with the project and is sent to synthesis.
- Deep mode runs two independent candidates before the Judge sees either result.
- Candidate or Judge failure degrades to the strongest available valid result
  without discarding completed reference analyses.
- The normal analysis page remains concise while allowing the comparison to be
  inspected on demand.
- Automated and browser checks cover both modes, responsive layout, accessibility,
  and error fallback.

## Design evidence

These same-day verified references from the multi-reference flow remain applicable:

1. **Google NotebookLM source workflow** —
   <https://support.google.com/notebooklm/answer/16215270?hl=en>, reviewed
   2026-07-23. Observed independent sources retained beneath a synthesized
   result. Adapted by keeping model candidates secondary to the final blueprint.
   Do not copy Google branding, chat layout, or source icons.
2. **YouTube playlist management** —
   <https://support.google.com/youtube/answer/10232933?hl=en>, reviewed
   2026-07-23. Observed distinct items managed as one collection. Adapted as two
   named editorial candidates inside one analysis run. Do not copy playlist UI,
   thumbnails, controls, or branding.
3. **Adobe Express scene workflow** —
   <https://helpx.adobe.com/express/web/create-and-edit-videos/create-videos/add-scenes.html>,
   reviewed 2026-07-23. Observed individually inspectable components producing
   one final work. Adapted through progressive disclosure of candidate judgments.
   Do not copy Adobe editor, timeline, toolbar, or visual identity.

## Journey and states

1. Creator selects `Standard` or `Deep analysis` in Output settings.
2. Reference extraction and individual analyses remain unchanged.
3. Standard produces one synthesis; Deep produces Hook/retention and
   flow/clarity candidates in parallel.
4. Judge receives only completed abstract analyses and candidate blueprints.
5. Final blueprint is primary. `How the models compared` reveals concise candidate
   summaries, the integration decision, and confidence.
6. One candidate failure uses the other. Judge failure uses a valid candidate.

## Planned files

- `frontend/core.mjs`
- `frontend/pages/new-project.mjs`
- `frontend/pages/analysis.mjs`
- `frontend/service-client.mjs`
- `frontend/mock-services.mjs`
- `frontend/styles.css`
- `frontend/tests/creatorpilot.test.mjs`
- `frontend/tests/browser-cdp.py`
- `backend/src/agents/script-analyst/*`
- `backend/tests/analysis-tests.js`

## Validation and self-review

- Frontend contract and rendering suite: 40/40 passed.
- Backend suite: 147/147 passed, including parallel candidates, candidate
  failure, Judge failure, invalid mode, and request lineage.
- Full browser workflow passed against the API fixture at desktop and mobile
  widths. Deep selection, model comparison disclosure, backward navigation,
  accessible names, console errors, and horizontal overflow were checked.
- Browser evidence is stored beside this plan in `deep-analysis-evidence/`.
- Self-review kept the final blueprint primary and placed candidate details in
  a collapsed disclosure to avoid bringing model orchestration into the main
  reading flow. The loading copy was revised to disclose the Judge step.
- Weakness: external providers were not charged during automated validation.
  Deployments must set Deep-role model IDs to get true model diversity;
  otherwise all three roles intentionally reuse the main Analyst model.
