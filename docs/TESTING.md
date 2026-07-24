# Testing

## Quick checks

```sh
node --input-type=module --check < frontend/app.js
node --check frontend/core.mjs
node --check frontend/mock-services.mjs
node --check frontend/service-client.mjs
node --check frontend/pages/analysis.mjs
node frontend/tests/creatorpilot.test.mjs
cd backend && npm test && npm audit
```

Verify a running backend with:

```sh
curl http://127.0.0.1:8787/api/health
```

Expected response:

```json
{"status":"ok","service":"creatorpilot-backend"}
```

## Manual API checks

Test transcript extraction directly:

```sh
curl -X POST http://127.0.0.1:8787/api/transcripts/extract \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"manual-check","youtubeUrl":"https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID","targetLanguage":"English"}'
```

The analysis endpoint follows the request schema in
`docs/BACKEND_API_CONTRACT.md`: `projectId`, the normalized `transcript`,
`targetDurationSeconds`, and optional `analysisLanguage`.

The Research endpoint accepts the user's tailored creative brief and a compact
reference blueprint, then returns a Fact Pack whose claim URLs are checked
against sources returned by the web-search provider. The Scriptwriter endpoint
accepts that same brief, blueprint, and Fact Pack. Both intentionally reject a
raw transcript. Script IDs, section IDs, version lineage, ranges, and
speaking-time estimates are controlled by the backend rather than accepted from
the model.

The Storyboard endpoint accepts the current generated script, divides its
unchanged narration into scene slots, and controls scene IDs and timing. The
model proposes captions, visual direction, search queries, and transitions; it
does not fetch or license assets.

## Live (paid) checks

For an optional rate-limited live check against a running backend:

```sh
cd backend
LIVE_YOUTUBE_URL='https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID' npm run test:live
```

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

To continue the paid live chain through Storyboard:

```sh
cd backend
LLM_API_BASE_URL='https://provider.example/v1' \
LLM_API_KEY='server-side-key' \
LLM_MODEL='model-id' \
LIVE_YOUTUBE_URL='https://www.youtube.com/watch?v=PUBLIC_VIDEO_ID' \
LIVE_SCRIPT_TOPIC='A new and unrelated topic' \
npm run test:live-storyboard
```

## Browser workflow test

`frontend/tests/browser-cdp.py` runs the complete workflow through a Chrome
DevTools connection and checks responsiveness, accessibility names, focus, and
console errors.

For a credential-free browser check of the HTTP boundary, start the
static server and Chrome DevTools as above, then run the injected fake-provider
backend and browser test in separate terminals:

```sh
cd backend && npm run dev:browser-fixture
```

```sh
CREATORPILOT_EXPECT_API_TRANSCRIPT=1 \
CREATORPILOT_EXPECT_API_ANALYSIS=1 \
CREATORPILOT_EXPECT_API_SCRIPT=1 \
CREATORPILOT_EXPECT_API_STORYBOARD=1 \
CREATORPILOT_TEST_YOUTUBE_URL='https://www.youtube.com/watch?v=jNQXAC9IVRw' \
python3 frontend/tests/browser-cdp.py
```

The fixture is test-only. Production LLM agents always use the configured
provider.

## Mock failure simulation

Add `?fast=1` before the hash to shorten mock service delays during testing.
Retryable mock failures can be inspected with one of these query parameters:

- `?fail=extractTranscript`
- `?fail=analyzeReference`
- `?fail=generateScript`
- `?fail=generateStoryboard`
