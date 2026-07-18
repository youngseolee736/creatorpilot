# CreatorPilot

CreatorPilot is a frontend-only AI multi-agent YouTube production studio. It
demonstrates a complete mock workflow from reference analysis through original
script editing, similarity review, storyboard generation, and video rendering.

## Run

```sh
python3 -m http.server 4173 --directory frontend
```

Open <http://127.0.0.1:4173/>. Add `?fast=1` before the hash to shorten mock
service delays during testing.

Project data is saved in versioned browser local storage. No URL, transcript, or
project content is sent to a backend. Export produces a JSON mock production
package rather than a media file.

`frontend/config.js` contains public runtime configuration. It defaults to
`useMockServices: true`. A backend integration environment can set it to `false`
and provide a same-origin or public `apiBaseUrl`; secrets must remain server-side.

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
```

`frontend/tests/browser-cdp.py` runs the complete workflow through a Chrome
DevTools connection and checks responsiveness, accessibility names, focus, and
console errors.
