# CreatorPilot

CreatorPilot is an AI multi-agent YouTube production studio. It
demonstrates a complete mock workflow from reference analysis through original
script editing, similarity review, storyboard generation, and video rendering.

Phase 1 adds a small Express backend for real YouTube transcript extraction. All
later agents and production services remain mocked.

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
service to mock mode. To test only real transcript extraction, keep the backend
running and use this configuration:

```js
window.CREATORPILOT_CONFIG = Object.freeze({
  services: {
    transcript: "api",
    analysis: "mock",
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
node frontend/tests/creatorpilot.test.mjs
cd backend && npm test
```

`frontend/tests/browser-cdp.py` runs the complete workflow through a Chrome
DevTools connection and checks responsiveness, accessibility names, focus, and
console errors.

## Transcript provider limitations

CreatorPilot Phase 1 integrates the unofficial
`youtube-transcript-api-tau-one.vercel.app` service from the backend only. The
provider documents a five-request-per-minute rate limit, and its availability and
response format are not guaranteed. Some public, private, age-restricted, or
caption-disabled videos do not expose transcripts. Auto-generated captions may
contain transcription and timing errors. Access public transcripts responsibly
and do not treat transcript availability as permission to republish source text.

During validation on 2026-07-18, the provider returned the same unsupported
stream-like placeholder for two different captioned public videos. CreatorPilot
correctly rejected those responses with `502 TRANSCRIPT_PROVIDER_ERROR`; retry the
optional live check later rather than weakening response validation.

The backend does not store transcripts in Phase 1, does not log transcript bodies,
rejects malformed provider output, and maps provider timeouts, rate limits, and
unavailable captions to structured user-safe errors.
