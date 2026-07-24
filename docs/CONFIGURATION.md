# Configuration

All integration values are server-side. Do not commit a real `.env` or place
provider credentials in frontend files. Keep real credentials only in your local
`backend/.env` file or in the deployment provider's secret/environment settings.

## Transcript provider

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

## LLM agents

The Script Analyst, Research Agent, Scriptwriter, and
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

STORYBOARD_LLM_MODEL=vendor/visual-planning-model
```

## Storyboard image previews

Storyboard still images are optional and generated only when the user clicks
the AI image button in the Storyboard Preview. The image provider reuses the
shared OpenRouter key and base URL when `IMAGE_API_KEY` or
`IMAGE_API_BASE_URL` are blank:

```dotenv
IMAGE_PROVIDER=openrouter
IMAGE_API_BASE_URL=
IMAGE_API_KEY=
IMAGE_MODEL=google/gemini-3.1-flash-lite-image
IMAGE_TIMEOUT_MS=300000
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

## Deep mode (ensemble)

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
`SCRIPTWRITER_JUDGE_`, and `STORYBOARD_`;
each accepts `LLM_PROVIDER`, `LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, and
`LLM_TIMEOUT_MS`. Set `LLM_PROVIDER=openrouter` for the built-in OpenRouter
gateway, or `openai-compatible` for another compatible Chat Completions
endpoint. Native Gemini or Anthropic contracts require an additional provider
adapter.

The backend and mock-only frontend work without these values. Calling any real
LLM endpoint without complete configuration returns `LLM_NOT_CONFIGURED`.
Never add an LLM key to `frontend/config.js`.

## Frontend configuration

`frontend/config.js` contains public runtime configuration. The checked-in
development configuration enables all five API boundaries. Keep the
backend running and use this shape:

```js
window.CREATORPILOT_CONFIG = Object.freeze({
  services: {
    transcript: "api",
    analysis: "api",
    research: "api",
    script: "api",
    storyboard: "api",
    image: "api",
  },
  apiBaseUrl: "http://127.0.0.1:8787",
});
```

The legacy `useMockServices: true|false` switch remains supported. Per-service
configuration takes precedence. No backend secret belongs in this public object.
Set any service back to `"mock"` for the deterministic, backend-free workflow.
