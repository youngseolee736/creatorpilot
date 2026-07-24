# CreatorPilot

CreatorPilot is an AI multi-agent YouTube production studio. It
demonstrates a complete mock workflow from reference analysis through original
script editing, similarity review, storyboard generation, and video rendering.

Phase 1 adds real YouTube transcript extraction. Phase 2 adds a configurable,
LLM-powered Script Analyst that converts a transcript into validated abstract
storytelling mechanics. Phase 3 adds real initial and revision Scriptwriter
flows. Phase 4 adds a real, conservative Originality Reviewer. Phase 5 adds a
server-authorized Storyboard Agent. Phase 6 adds a server-verified Video
Producer boundary for an adapter-compatible asynchronous render provider.
Phase 7 inserts a source-grounded Research Agent and tailored creative brief
between reference analysis and scriptwriting.

## Requirements

- Python 3 for the static frontend server
- Node.js 14.15 or newer for the backend
- npm

## Backend setup

```sh
cd backend
npm install
cp .env.example .env
npm run dev
```

The backend runs at <http://127.0.0.1:8787>. Verify it with:

```sh
curl http://127.0.0.1:8787/api/health
```

Expected response:

```json
{"status":"ok","service":"creatorpilot-backend"}
```

`backend/.env.example` documents the public integration configuration. Do not
commit a real `.env` or place provider credentials in frontend files.

Transcript extraction uses the local `youtube-transcript` adapter by default.
The hosted HTTP adapter is retained only as an explicit compatibility option:

```dotenv
TRANSCRIPT_PROVIDER=local
TRANSCRIPT_HTTP_FALLBACK_ENABLED=false
```

Set `TRANSCRIPT_PROVIDER=hosted` to use `TRANSCRIPT_API_URL` directly, or set
`TRANSCRIPT_HTTP_FALLBACK_ENABLED=true` to try that endpoint only after a
retryable local-provider failure. Keep fallback disabled unless the configured
endpoint is trusted and its request and response contract has been verified.

The Script Analyst, Research Agent, Scriptwriter, Originality Reviewer, and
Storyboard Agent can share one OpenRouter connection. An OpenRouter model slug
selects the concrete model for each request. All values remain server-side:

```dotenv
LLM_PROVIDER=openrouter
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=replace-with-server-side-key
LLM_MODEL=vendor/default-model-slug
LLM_TIMEOUT_MS=300000

# Optional OpenRouter attribution.
OPENROUTER_HTTP_REFERER=https://your-app.example
OPENROUTER_APP_TITLE=CreatorPilot
```

Each LLM Agent can override any shared value independently. Blank or omitted
Agent values fall back field-by-field to `LLM_*`, so a deployment can change
only a model while reusing the same OpenRouter key and endpoint:

```dotenv
ANALYST_LLM_MODEL=vendor/standard-analysis-model

# Deep analysis: two independent candidates and a final Judge.
ANALYST_A_LLM_MODEL=vendor-a/hook-specialist-model
ANALYST_B_LLM_MODEL=vendor-b/structure-specialist-model
ANALYST_JUDGE_LLM_MODEL=vendor-c/strong-judge-model

SCRIPTWRITER_LLM_MODEL=vendor/standard-writing-model

REVIEWER_LLM_MODEL=vendor/conservative-review-model
STORYBOARD_LLM_MODEL=vendor/visual-planning-model
```

The Research Agent uses the Responses API rather than Chat Completions. It
automatically sends OpenRouter's `openrouter:web_search` server tool when the
provider or base URL identifies OpenRouter. It reuses the shared URL and key;
only role-specific model slugs are needed. Web research defaults to a
five-minute timeout:

```dotenv
RESEARCH_LLM_MODEL=vendor/standard-research-model
RESEARCH_LLM_TIMEOUT_MS=300000

# Deep research roles share LLM_API_KEY and LLM_API_BASE_URL.
RESEARCH_A_LLM_MODEL=vendor-a/direct-evidence-model
RESEARCH_B_LLM_MODEL=vendor-b/narrative-research-model
RESEARCH_JUDGE_LLM_MODEL=vendor-c/research-judge-model
```

Claim-led full-duration Scriptwriter calls also default to five minutes per
model call so a contract repair pass is not cut off by the shorter shared
timeout. Override it independently when needed:

```dotenv
SCRIPTWRITER_LLM_TIMEOUT_MS=300000

# Optional Deep writing roles.
SCRIPTWRITER_A_LLM_MODEL=vendor-a/storytelling-model
SCRIPTWRITER_B_LLM_MODEL=vendor-b/evidence-writing-model
SCRIPTWRITER_JUDGE_LLM_MODEL=vendor-c/writing-judge-model
```

Deep analysis is an optional project-wide ensemble. The Analyst compares hook
and flow blueprints, Research compares a direct-evidence case with a truthful
narrative case, and Scriptwriter compares story momentum with evidence clarity.
Each stage validates two parallel candidates before a final Judge creates the
result. A candidate failure uses the other valid candidate; a Judge failure uses
the first validated candidate. Blank Deep-role values reuse that stage's main
provider, which is useful for local development but does not create true model
diversity. Configure distinct `*_A_LLM_MODEL`, `*_B_LLM_MODEL`, and
`*_JUDGE_LLM_MODEL` values when independent models are required. Research roles
use OpenRouter's Responses API server web search tool; Analyst and Scriptwriter
roles use OpenRouter's OpenAI-compatible Chat Completions contract. OpenRouter
routing and fallback are separate from this ensemble: the backend starts both
candidates and sends their validated results to the Judge. Deep mode can use
three calls per stage plus contract-repair calls, so it costs more and takes
longer than Standard.

The supported prefixes are `ANALYST_`, `ANALYST_A_`, `ANALYST_B_`,
`ANALYST_JUDGE_`, `RESEARCH_`, `RESEARCH_A_`, `RESEARCH_B_`,
`RESEARCH_JUDGE_`, `SCRIPTWRITER_`, `SCRIPTWRITER_A_`, `SCRIPTWRITER_B_`,
`SCRIPTWRITER_JUDGE_`, `REVIEWER_`, and `STORYBOARD_`;
each accepts `LLM_PROVIDER`, `LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, and
`LLM_TIMEOUT_MS`. Set `LLM_PROVIDER=openrouter` for the built-in OpenRouter
gateway, or `openai-compatible` for another compatible Chat Completions
endpoint. Native Gemini or Anthropic contracts require an additional provider
adapter.

The backend and mock-only frontend work without these values. Calling any real
LLM endpoint without complete configuration returns `LLM_NOT_CONFIGURED`.
Never add an LLM key to `frontend/config.js`.

The Video Producer never inherits any `LLM_*` or Agent-specific value. It uses a
separate generic server-side HTTP provider contract. The base
URL must expose `POST /renders` and `GET /renders/:providerJobId`. HTTPS is
required outside localhost, and credentials never enter the browser bundle:

```dotenv
RENDER_API_BASE_URL=https://render-provider.example/v1
RENDER_API_KEY=replace-with-server-side-key
RENDER_TIMEOUT_MS=30000
```

Without complete render configuration, the API returns
`RENDER_NOT_CONFIGURED`; mock video mode remains available independently.

Shotstack is supported as the concrete final-composition provider. Start with
the watermarked Stage endpoint and Stage key shown in the Shotstack dashboard:

```dotenv
RENDER_PROVIDER=shotstack
SHOTSTACK_API_URL=https://api.shotstack.io/edit/stage/render
SHOTSTACK_API_KEY=replace-with-stage-key
SHOTSTACK_TIMEOUT_MS=30000
```

The adapter converts approved Storyboard timing and captions into a portrait
Shotstack Edit timeline, authenticates with `x-api-key`, and normalizes queued,
fetching, preprocessing, rendering, saving, done, and failed statuses. The
initial Stage integration renders caption-based scene cards and does not invoke
paid AI image, video, or text-to-speech assets. Supplying real scene media and
narration audio is a separate asset-generation step. Use the Production URL and
key only after the Stage workflow is approved.

After saving the Stage variables, verify only the Shotstack connection with a
two-second watermarked title render (no LLM chain or AI asset request):

```sh
cd backend
npm run test:live-shotstack
```

## Frontend setup

```sh
python3 -m http.server 4173 --directory frontend
```

Open <http://127.0.0.1:4173/>. Add `?fast=1` before the hash to shorten mock
service delays during testing.

Project data is saved in versioned browser local storage. No URL, transcript, or
project content is sent to a backend while mock mode is active. Export produces a
JSON mock production package rather than a media file.

`frontend/config.js` contains public runtime configuration. The checked-in Phase
7 development configuration enables all seven API boundaries. Keep the
backend running and use this shape:

```js
window.CREATORPILOT_CONFIG = Object.freeze({
  services: {
    transcript: "api",
    analysis: "api",
    research: "api",
    script: "api",
    review: "api",
    storyboard: "api",
    video: "api",
  },
  apiBaseUrl: "http://127.0.0.1:8787",
  renderPollIntervalMs: 1500,
  renderPollLimit: 240,
});
```

The legacy `useMockServices: true|false` switch remains supported. Per-service
configuration takes precedence. No backend secret belongs in this public object.
Set any service, including video, back to `"mock"` for the deterministic,
backend-free workflow.

Test transcript extraction directly:

```sh
curl -X POST http://127.0.0.1:8787/api/transcripts/extract \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"manual-check","youtubeUrl":"https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID","targetLanguage":"English"}'
```

For an optional rate-limited live check against a running backend:

```sh
cd backend
LIVE_YOUTUBE_URL='https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID' npm run test:live
```

The analysis endpoint follows the request schema in
`docs/BACKEND_API_CONTRACT.md`: `projectId`, the normalized `transcript`,
`targetDurationSeconds`, and optional `analysisLanguage`.

The Research endpoint accepts the user's tailored creative brief and a compact
reference blueprint, then returns a Fact Pack whose claim URLs are checked
against sources returned by the web-search provider. The Scriptwriter endpoint
accepts that same brief, blueprint, and Fact Pack. Both intentionally reject a
raw transcript. Script
IDs, section IDs, version lineage, ranges, and speaking-time estimates are
controlled by the backend rather than accepted from the model.

The Reviewer endpoint accepts the exact normalized reference transcript,
abstract analysis, and current script because phrase comparison requires both
texts. The backend controls review identity, overall score, risk bands, pass/fail
thresholds, and the non-legal disclaimer. Model-proposed phrase evidence is
accepted only when it is a bounded exact excerpt from the submitted texts.

The Storyboard endpoint accepts only the ID of a passed review that remains in
the running backend's Reviewer registry. The backend verifies that review against
the exact script, divides the unchanged narration into scene slots, and controls
scene IDs and timing. The model proposes captions, visual direction, search
queries, and transitions; it does not fetch or license assets.

Run one optional live transcript-plus-LLM check only when valid server-side LLM
credentials are present:

```sh
cd backend
LLM_API_BASE_URL='https://provider.example/v1' \
LLM_API_KEY='server-side-key' \
LLM_MODEL='model-id' \
LIVE_YOUTUBE_URL='https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID' \
npm run test:live-analysis
```

Without those LLM variables, the command reports `SKIP` and makes no paid API
request.

To perform the full live transcript, analysis, and first-draft check, explicitly
provide a new topic. This can make more than one paid LLM request because an invalid
draft can receive up to two targeted repair attempts:

```sh
cd backend
LLM_API_BASE_URL='https://provider.example/v1' \
LLM_API_KEY='server-side-key' \
LLM_MODEL='model-id' \
LIVE_YOUTUBE_URL='https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID' \
LIVE_SCRIPT_TOPIC='A new and unrelated topic' \
npm run test:live-scriptwriter
```

To extend that paid live check through the Originality Reviewer, use the same
variables with:

```sh
cd backend
LLM_API_BASE_URL='https://provider.example/v1' \
LLM_API_KEY='server-side-key' \
LLM_MODEL='model-id' \
LIVE_YOUTUBE_URL='https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID' \
LIVE_SCRIPT_TOPIC='A new and unrelated topic' \
npm run test:live-reviewer
```

To continue the paid live chain through Storyboard when the live review passes:

```sh
cd backend
LLM_API_BASE_URL='https://provider.example/v1' \
LLM_API_KEY='server-side-key' \
LLM_MODEL='model-id' \
LIVE_YOUTUBE_URL='https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID' \
LIVE_SCRIPT_TOPIC='A new and unrelated topic' \
npm run test:live-storyboard
```

To continue the paid live chain through a configured render provider, add the
render variables and run `npm run test:live-render`. It reports `SKIP` unless
all transcript, LLM, topic, and render variables are explicitly present.

Retryable mock failures can be inspected with one of these query parameters:

- `?fail=extractTranscript`
- `?fail=analyzeReference`
- `?fail=generateScript`
- `?fail=reviewOriginality`
- `?fail=generateStoryboard`
- `?fail=renderVideo`

## Checks

```sh
node --input-type=module --check < frontend/app.js
node --check frontend/core.mjs
node --check frontend/mock-services.mjs
node --check frontend/service-client.mjs
node --check frontend/pages/analysis.mjs
node frontend/tests/creatorpilot.test.mjs
cd backend && npm test && npm audit
```

`frontend/tests/browser-cdp.py` runs the complete workflow through a Chrome
DevTools connection and checks responsiveness, accessibility names, focus, and
console errors.

For a credential-free browser check of the Phase 6 HTTP boundary, start the
static server and Chrome DevTools as above, then run the injected fake-provider
backend and browser test in separate terminals:

```sh
cd backend && npm run dev:browser-fixture
```

```sh
CREATORPILOT_EXPECT_API_TRANSCRIPT=1 \
CREATORPILOT_EXPECT_API_ANALYSIS=1 \
CREATORPILOT_EXPECT_API_SCRIPT=1 \
CREATORPILOT_EXPECT_API_REVIEW=1 \
CREATORPILOT_EXPECT_API_STORYBOARD=1 \
CREATORPILOT_EXPECT_API_VIDEO=1 \
CREATORPILOT_TEST_YOUTUBE_URL='https://www.youtube.com/watch?v=jNQXAC9IVRw' \
python3 frontend/tests/browser-cdp.py
```

The fixture is test-only. Production LLM agents always use the configured
provider.

## Transcript provider limitations

CreatorPilot Phase 1 uses the unofficial `youtube-transcript` package from the
backend only. It reads YouTube caption endpoints without an official YouTube API
contract, so upstream markup, response formats, blocking behavior, and transcript
availability can change without notice. Some public, private, age-restricted, or
caption-disabled videos do not expose transcripts. Auto-generated captions may
contain transcription and timing errors. The local adapter currently returns
`null` for the video title because caption extraction does not provide title
metadata.

The optional hosted adapter defaults to
`youtube-transcript-api-tau-one.vercel.app` when explicitly enabled. During
validation on 2026-07-18, that endpoint returned the same unsupported stream-like
placeholder for two different captioned public videos. CreatorPilot correctly
rejected those responses with `502 TRANSCRIPT_PROVIDER_ERROR`; do not enable the
hosted adapter or fallback without verifying the endpoint first.

Access public transcripts responsibly and do not treat transcript availability
as permission to republish source text.

The backend does not store transcripts in Phase 1, does not log transcript bodies,
rejects malformed provider output, and maps provider timeouts, rate limits, and
unavailable captions to structured user-safe errors.

## LLM agent privacy and limitations

When analysis API mode is enabled, the full transcript and timing segments are
sent from the CreatorPilot backend to the configured LLM provider. CreatorPilot
does not persist the transcript or raw model response in Phase 2, and neither is
logged by application code. The provider may retain inputs according to its own
terms, so configure only an approved provider and retention policy.

The Script Analyst treats transcript text as untrusted content, requests JSON
only, validates and normalizes the result, rejects long source excerpts, and
makes one structured repair attempt for malformed JSON. These controls reduce
risk but do not make model analysis deterministic or guarantee originality.
The Scriptwriter receives the tailored brief, compact blueprint, and approved
Fact Pack but never the raw reference transcript. Revision requests additionally send the current draft
and explicit instructions to the configured provider. The Reviewer receives the
reference transcript and exact draft because it must compare them. It validates
bounded phrase evidence and supplies a server-controlled verdict and disclaimer.
The Research Agent searches the public web and exposes provider-returned sources,
but neither citations nor model output guarantee factual accuracy. The backend
has no external plagiarism database and cannot guarantee legal clearance or exhaustive originality.
Reviewer results are editorial estimates, not copyright determinations or legal
advice. The Storyboard Agent receives the exact script narration and proposes
visual metadata only. Search queries do not establish asset availability,
accuracy, suitability, or licensing.
