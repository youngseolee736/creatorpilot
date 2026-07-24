const assert = require("assert");
const http = require("http");
const AbortController = require("abort-controller");
const { createApp } = require("../src/app");
const { OpenRouterImageProvider, safeImagePrompt } = require("../src/services/image-provider");

const tests = [];
function test(name, callback) { tests.push({ name, callback }); }

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
  };
}

async function request(app, path, body) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const payload = JSON.stringify(body);

  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port: server.address().port,
        path,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
      });
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function providerWith(fetchImpl, overrides = {}) {
  return new OpenRouterImageProvider({
    apiBaseUrl: "https://openrouter.ai/api/v1",
    apiKey: "test-key",
    model: "google/gemini-3.1-flash-lite-image",
    timeoutMs: 50,
    fetchImpl,
    AbortControllerImpl: AbortController,
    ...overrides,
  });
}

test("builds an image prompt from storyboard scene fields", () => {
  const prompt = safeImagePrompt({
    narration: "Everyone thinks the answer is obvious.",
    caption: "The obvious answer",
    visual: "A vertical documentary shot of a city skyline at dawn.",
  });
  assert.match(prompt, /city skyline/);
  assert.match(prompt, /Narration context/);
});

test("generates storyboard images through the OpenRouter image endpoint", async () => {
  let call;
  const imageProvider = providerWith(async (url, options) => {
    call = { url, body: JSON.parse(options.body), headers: options.headers };
    return response(200, { data: [{ b64_json: Buffer.from("png").toString("base64"), media_type: "image/png" }] });
  });
  const app = createApp({ imageProvider });
  const result = await request(app, "/api/images/generate", {
    projectId: "project-image",
    sceneId: "scene-1",
    caption: "A new view",
    visual: "A cinematic vertical preview of a notebook and city map.",
    aspectRatio: "9:16",
  });
  assert.equal(result.status, 201);
  assert.equal(call.url, "https://openrouter.ai/api/v1/images");
  assert.equal(call.body.model, "google/gemini-3.1-flash-lite-image");
  assert.equal(call.body.aspect_ratio, "9:16");
  assert.equal(call.headers.Authorization, "Bearer test-key");
  assert.match(result.body.data.imageDataUrl, /^data:image\/png;base64,/);
});

test("returns a user-safe configuration error when no image key is available", async () => {
  const original = {
    IMAGE_API_KEY: process.env.IMAGE_API_KEY,
    LLM_API_KEY: process.env.LLM_API_KEY,
  };
  process.env.IMAGE_API_KEY = "";
  process.env.LLM_API_KEY = "";
  try {
    const imageProvider = new OpenRouterImageProvider({
      apiBaseUrl: "https://openrouter.ai/api/v1",
      model: "test-model",
      timeoutMs: 50,
      fetchImpl: async () => response(200, {}),
      AbortControllerImpl: AbortController,
    });
    const app = createApp({ imageProvider });
    const result = await request(app, "/api/images/generate", {
      projectId: "project-image",
      sceneId: "scene-1",
      imagePrompt: "A safe storyboard preview.",
    });
    assert.equal(result.status, 500);
    assert.equal(result.body.error.code, "IMAGE_NOT_CONFIGURED");
    assert.equal(result.body.error.retryable, false);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("blank image-specific settings fall back to shared OpenRouter settings", async () => {
  let call;
  const original = {
    IMAGE_API_BASE_URL: process.env.IMAGE_API_BASE_URL,
    IMAGE_API_KEY: process.env.IMAGE_API_KEY,
    IMAGE_MODEL: process.env.IMAGE_MODEL,
    IMAGE_TIMEOUT_MS: process.env.IMAGE_TIMEOUT_MS,
    LLM_API_BASE_URL: process.env.LLM_API_BASE_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
  };
  process.env.IMAGE_API_BASE_URL = "";
  process.env.IMAGE_API_KEY = "";
  process.env.IMAGE_MODEL = "";
  process.env.IMAGE_TIMEOUT_MS = "";
  process.env.LLM_API_BASE_URL = "https://openrouter.ai/api/v1";
  process.env.LLM_API_KEY = "shared-key";
  process.env.LLM_PROVIDER = "openrouter";
  try {
    const provider = new OpenRouterImageProvider({
      fetchImpl: async (url, options) => {
        call = { url, body: JSON.parse(options.body), headers: options.headers };
        return response(200, { data: [{ b64_json: Buffer.from("png").toString("base64"), media_type: "image/png" }] });
      },
      AbortControllerImpl: AbortController,
    });
    const result = await provider.generate({ imagePrompt: "A safe storyboard preview." });
    assert.match(result.imageDataUrl, /^data:image\/png;base64,/);
    assert.equal(call.url, "https://openrouter.ai/api/v1/images");
    assert.equal(call.headers.Authorization, "Bearer shared-key");
    assert.equal(call.body.model, "google/gemini-3.1-flash-lite-image");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("maps provider failures without leaking provider response bodies", async () => {
  const app = createApp({ imageProvider: providerWith(async () => response(503, { error: "secret provider text" })) });
  const result = await request(app, "/api/images/generate", {
    projectId: "project-image",
    sceneId: "scene-1",
    imagePrompt: "A safe storyboard preview.",
  });
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "IMAGE_PROVIDER_ERROR");
  assert.doesNotMatch(result.body.error.message, /secret/);
});

let failures = 0;
(async () => {
  for (const { name, callback } of tests) {
    try {
      await callback();
      console.log(`✓ ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`✗ ${name}`);
      console.error(error);
    }
  }
  console.log(`\n${tests.length - failures}/${tests.length} image tests passed`);
  if (failures) process.exitCode = 1;
})();
