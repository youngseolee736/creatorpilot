# CreatorPilot

CreatorPilot is an AI multi-agent YouTube production studio. It
demonstrates a complete mock workflow from reference analysis through original
script editing, similarity review, storyboard generation, and video rendering.

Phase 1 adds real YouTube transcript extraction. Phase 2 adds a configurable,
LLM-powered Script Analyst that converts a transcript into validated abstract
storytelling mechanics. Scriptwriting, originality review, storyboarding, and
video production remain mocked.

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

The Script Analyst defaults to an OpenAI-compatible Chat Completions provider.
All values remain server-side:

```dotenv
LLM_PROVIDER=openai-compatible
LLM_API_BASE_URL=https://api.example.com/v1
LLM_API_KEY=replace-with-server-side-key
LLM_MODEL=replace-with-model-id
LLM_TIMEOUT_MS=30000
```

The backend and mock-only frontend work without these values. Calling the real
analysis endpoint without complete configuration returns `LLM_NOT_CONFIGURED`.
Never add an LLM key to `frontend/config.js`.

## Frontend setup

```sh
python3 -m http.server 4173 --directory frontend
```

Open <http://127.0.0.1:4173/>. Add `?fast=1` before the hash to shorten mock
service delays during testing.

Project data is saved in versioned browser local storage. No URL, transcript, or
project content is sent to a backend while mock mode is active. Export produces a
JSON mock production package rather than a media file.

`frontend/config.js` contains public runtime configuration and defaults every
service to mock mode. For the Phase 2 mixed workflow, keep the backend running
and use this configuration:

```js
window.CREATORPILOT_CONFIG = Object.freeze({
  services: {
    transcript: "api",
    analysis: "api",
    script: "mock",
    review: "mock",
    storyboard: "mock",
    video: "mock",
  },
  apiBaseUrl: "http://127.0.0.1:8787",
  renderPollIntervalMs: 1500,
});
```

The legacy `useMockServices: true|false` switch remains supported. Per-service
configuration takes precedence. No backend secret belongs in this public object.
Set both `transcript` and `analysis` back to `"mock"` for the deterministic,
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

For a credential-free browser check of the Phase 2 HTTP boundary, start the
static server and Chrome DevTools as above, then run the injected fake-provider
backend and browser test in separate terminals:

```sh
cd backend && npm run dev:browser-fixture
```

```sh
CREATORPILOT_EXPECT_API_TRANSCRIPT=1 \
CREATORPILOT_EXPECT_API_ANALYSIS=1 \
CREATORPILOT_TEST_YOUTUBE_URL='https://www.youtube.com/watch?v=jNQXAC9IVRw' \
python3 frontend/tests/browser-cdp.py
```

The fixture is test-only. Production analysis always uses the configured LLM
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

## Script Analyst privacy and limitations

When analysis API mode is enabled, the full transcript and timing segments are
sent from the CreatorPilot backend to the configured LLM provider. CreatorPilot
does not persist the transcript or raw model response in Phase 2, and neither is
logged by application code. The provider may retain inputs according to its own
terms, so configure only an approved provider and retention policy.

The Script Analyst treats transcript text as untrusted content, requests JSON
only, validates and normalizes the result, rejects long source excerpts, and
makes one structured repair attempt for malformed JSON. These controls reduce
risk but do not make model analysis deterministic or guarantee originality.
Later Scriptwriter output remains mocked, and the real Originality Reviewer has
not yet been implemented. Its future similarity checks will be product estimates,
not copyright clearance or legal advice.
