const assert = require("assert");
const http = require("http");
const { VideoProducer } = require("../src/agents/video-producer/video-producer");
const { HttpRenderProvider } = require("../src/services/render/http-render-provider");
const { createRenderProvider } = require("../src/services/render");
const { ShotstackRenderProvider, toShotstackEdit } = require("../src/services/render/shotstack-render-provider");
const { createApp } = require("../src/app");

const tests = [];
function test(name, callback) { tests.push({ name, callback }); }

class FakeRenderProvider {
  constructor({ start, statuses = [] }) {
    this.startOutput = start;
    this.statuses = [...statuses];
    this.startCalls = [];
    this.statusCalls = [];
  }

  async startRender(productionPackage, idempotencyKey) {
    this.startCalls.push({ productionPackage, idempotencyKey });
    if (this.startOutput instanceof Error) throw this.startOutput;
    if (typeof this.startOutput === "function") return this.startOutput(productionPackage, idempotencyKey);
    return this.startOutput;
  }

  async getStatus(providerJobId) {
    this.statusCalls.push(providerJobId);
    const output = this.statuses.length > 1 ? this.statuses.shift() : this.statuses[0];
    if (output instanceof Error) throw output;
    return output;
  }
}

async function request(app, method, path, body) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method,
        headers: { "Content-Type": "application/json" },
      }, (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      });
      req.on("error", reject);
      req.end(body == null ? undefined : JSON.stringify(body));
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function scenes() {
  return [
    {
      id: "scene-1", number: 1, start: 0, end: 30, duration: 30,
      narration: "The first half of the approved narration remains exact.",
      caption: "First approved scene", visual: "A restrained vertical opening composition.",
      searchQuery: "licensed opening infrastructure vertical", transition: "Straight cut",
    },
    {
      id: "scene-2", number: 2, start: 30, end: 60, duration: 30,
      narration: "The second half resolves the approved narration without changes.",
      caption: "Second approved scene", visual: "A clear closing composition with restrained motion.",
      searchQuery: "licensed closing infrastructure vertical", transition: "Fade out",
    },
  ];
}

function validInput(overrides = {}) {
  return {
    projectId: "project-video",
    approvedReviewId: "review-video",
    storyboard: scenes(),
    productionSettings: { voice: "Min — Clear explainer", captions: "Editorial high contrast", music: false },
    format: "9:16",
    durationSeconds: 60,
    ...overrides,
  };
}

function approvedRecord() {
  return {
    storyboard: {
      storyboardId: "storyboard-video",
      scriptId: "script-video",
      reviewId: "review-video",
      format: "9:16",
      totalDuration: 60,
      scenes: scenes(),
    },
    script: {
      scriptId: "script-video",
      title: "Approved production",
      version: 1,
      estimatedSeconds: 60,
      sections: [{ id: "full", label: "Full", range: "0–60s", text: scenes().map((scene) => scene.narration).join(" ") }],
    },
  };
}

function producerWith(provider, options = {}) {
  const review = options.review === undefined
    ? { reviewId: "review-video", scriptId: "script-video", status: "passed" }
    : options.review;
  const record = options.record === undefined ? approvedRecord() : options.record;
  return new VideoProducer({
    provider,
    reviewResolver: async (reviewId) => reviewId === review?.reviewId ? review : null,
    storyboardResolver: async (reviewId, submittedScenes) => (
      reviewId === record?.storyboard?.reviewId && JSON.stringify(submittedScenes) === JSON.stringify(record.storyboard.scenes)
        ? record
        : null
    ),
  });
}

function queuedProvider(statuses = []) {
  return new FakeRenderProvider({
    start: { jobId: "provider-job-1", status: "queued", stage: "Preparing production", progress: 2 },
    statuses,
  });
}

test("starts an authorized asynchronous render with a server package", async () => {
  const provider = queuedProvider();
  const producer = producerWith(provider);
  const result = await producer.start(validInput());
  assert.match(result.renderId, /^render_[a-f0-9]{20}$/);
  assert.equal(result.status, "queued");
  assert.equal(result.completed, false);
  assert.equal(result.source, "provider");
  assert.equal(result.statusUrl, `/api/videos/${result.renderId}/status`);
  assert.equal(provider.startCalls.length, 1);
  assert.equal(provider.startCalls[0].productionPackage.approvedReview.status, "passed");
  assert.equal(provider.startCalls[0].productionPackage.script.scriptId, "script-video");
  assert.equal(provider.startCalls[0].productionPackage.storyboard.storyboardId, "storyboard-video");
  assert.match(provider.startCalls[0].idempotencyKey, /^[a-f0-9]{64}$/);
});

test("normalizes running and completed provider states", async () => {
  const provider = queuedProvider([
    { status: "running", stage: "Creating captions", progress: 66 },
    {
      status: "completed",
      completedAt: "2026-07-19T01:00:00Z",
      videoUrl: "https://media.example.test/video.mp4",
      productionPackageUrl: "https://media.example.test/package.json",
    },
  ]);
  const producer = producerWith(provider);
  const started = await producer.start(validInput());
  const running = await producer.status(started.renderId);
  assert.equal(running.status, "running");
  assert.equal(running.progress, 66);
  const completed = await producer.status(started.renderId);
  assert.equal(completed.status, "completed");
  assert.equal(completed.completed, true);
  assert.equal(completed.voice, "Min — Clear explainer");
  assert.equal(completed.videoUrl, "https://media.example.test/video.mp4");
  const cached = await producer.status(started.renderId);
  assert.deepEqual(cached, completed);
  assert.equal(provider.statusCalls.length, 2);
});

test("accepts completed provider media without an optional package URL", async () => {
  const provider = queuedProvider([{
    status: "completed",
    videoUrl: "https://cdn.shotstack.io/example/render.mp4",
  }]);
  const producer = producerWith(provider);
  const started = await producer.start(validInput());
  const completed = await producer.status(started.renderId);
  assert.equal(completed.videoUrl, "https://cdn.shotstack.io/example/render.mp4");
  assert.equal(Object.prototype.hasOwnProperty.call(completed, "productionPackageUrl"), false);
});

test("normalizes failed jobs without exposing provider diagnostics", async () => {
  const provider = queuedProvider([{ status: "failed", progress: 42, error: { message: "private vendor stack" } }]);
  const producer = producerWith(provider);
  const started = await producer.start(validInput());
  const failed = await producer.status(started.renderId);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error.code, "RENDER_FAILED");
  assert.doesNotMatch(JSON.stringify(failed), /private vendor stack/);
  await producer.status(started.renderId);
  assert.equal(provider.statusCalls.length, 1);
});

test("rejects missing reviews and modified storyboards before provider use", async () => {
  const missingProvider = queuedProvider();
  const missing = producerWith(missingProvider, { review: null });
  await assert.rejects(missing.start(validInput()), (error) => error.code === "REVIEW_NOT_FOUND");
  assert.equal(missingProvider.startCalls.length, 0);
  const changedProvider = queuedProvider();
  const changed = producerWith(changedProvider);
  const altered = validInput();
  altered.storyboard[0].caption = "Changed after approval";
  await assert.rejects(changed.start(altered), (error) => error.code === "STORYBOARD_NOT_APPROVED");
  assert.equal(changedProvider.startCalls.length, 0);
});

test("rejects failed reviews and mismatched approved formats", async () => {
  const failedProvider = queuedProvider();
  const failed = producerWith(failedProvider, {
    review: { reviewId: "review-video", scriptId: "script-video", status: "failed" },
  });
  await assert.rejects(failed.start(validInput()), (error) => error.code === "STORYBOARD_NOT_APPROVED");
  const formatProvider = queuedProvider();
  const record = approvedRecord();
  record.storyboard.format = "1:1";
  const mismatch = producerWith(formatProvider, { record });
  await assert.rejects(mismatch.start(validInput()), (error) => error.code === "ASSET_OR_TIMELINE_INVALID");
});

test("rejects invalid and incomplete timelines", async () => {
  const provider = queuedProvider();
  const producer = producerWith(provider);
  const gap = validInput();
  gap.storyboard[1].start = 31;
  const result = await request(createApp({ videoProducer: producer }), "POST", "/api/videos/render", gap);
  assert.equal(result.status, 422);
  assert.equal(result.body.error.code, "ASSET_OR_TIMELINE_INVALID");
  assert.equal(provider.startCalls.length, 0);
});

test("rejects unsupported settings and unexpected fields", async () => {
  const provider = queuedProvider();
  const producer = producerWith(provider);
  const music = validInput({ productionSettings: { voice: "Min", captions: "Editorial", music: "yes" } });
  const invalidMusic = await request(createApp({ videoProducer: producer }), "POST", "/api/videos/render", music);
  assert.equal(invalidMusic.body.error.code, "INVALID_RENDER_INPUT");
  const extraSetting = validInput({ productionSettings: {
    voice: "Min", captions: "Editorial", music: false, providerKey: "must-not-pass",
  } });
  const invalidSetting = await request(createApp({ videoProducer: producer }), "POST", "/api/videos/render", extraSetting);
  assert.equal(invalidSetting.body.error.details[0].field, "productionSettings.providerKey");
  const extraScene = validInput();
  extraScene.storyboard[0].assetUrl = "https://unapproved.example/asset.mp4";
  const invalidScene = await request(createApp({ videoProducer: producer }), "POST", "/api/videos/render", extraScene);
  assert.equal(invalidScene.body.error.details[0].field, "storyboard.0.assetUrl");
  const unexpected = await request(createApp({ videoProducer: producer }), "POST", "/api/videos/render", {
    ...validInput(), callbackUrl: "https://untrusted.example/callback",
  });
  assert.equal(unexpected.body.error.details[0].field, "callbackUrl");
});

test("reuses an existing job for idempotent and concurrent starts", async () => {
  const provider = new FakeRenderProvider({
    start: async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { jobId: "one-job", status: "queued", progress: 2, stage: "Preparing production" };
    },
  });
  const producer = producerWith(provider);
  const [first, second] = await Promise.all([producer.start(validInput()), producer.start(validInput())]);
  const third = await producer.start(validInput());
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  assert.equal(provider.startCalls.length, 1);
});

test("returns completed jobs immediately on an idempotent restart", async () => {
  const provider = queuedProvider([{
    status: "completed",
    videoUrl: "https://media.example.test/video.mp4",
    productionPackageUrl: "https://media.example.test/package.json",
  }]);
  const producer = producerWith(provider);
  const started = await producer.start(validInput());
  const completed = await producer.status(started.renderId);
  const repeated = await producer.start(validInput());
  assert.deepEqual(repeated, completed);
  assert.equal(repeated.completed, true);
  assert.equal(provider.startCalls.length, 1);
});

test("rejects malformed provider start and status responses", async () => {
  const badStart = producerWith(new FakeRenderProvider({ start: { status: "completed" } }));
  await assert.rejects(badStart.start(validInput()), (error) => error.code === "INVALID_RENDER_RESPONSE");
  const provider = queuedProvider([{ status: "mystery", progress: 50 }]);
  const producer = producerWith(provider);
  const started = await producer.start(validInput());
  await assert.rejects(producer.status(started.renderId), (error) => error.code === "INVALID_RENDER_RESPONSE");
});

test("rejects unsafe delivery URLs and invalid completion dates", async () => {
  const unsafe = queuedProvider([{
    status: "completed",
    completedAt: "not-a-date",
    videoUrl: "http://media.example.test/video.mp4",
    productionPackageUrl: "https://media.example.test/package.json",
  }]);
  const producer = producerWith(unsafe);
  const started = await producer.start(validInput());
  await assert.rejects(producer.status(started.renderId), (error) => error.code === "INVALID_RENDER_RESPONSE");
});

test("maps provider timeouts and capacity errors", async () => {
  const timeout = new Error("request aborted");
  timeout.name = "AbortError";
  const timed = producerWith(new FakeRenderProvider({ start: timeout }));
  await assert.rejects(timed.start(validInput()), (error) => error.code === "RENDER_TIMEOUT");
  const capacity = new Error("capacity reached");
  capacity.status = 429;
  const limited = producerWith(new FakeRenderProvider({ start: capacity }));
  await assert.rejects(limited.start(validInput()), (error) => error.code === "RENDER_CAPACITY_LIMITED");
});

test("returns not configured without making a network request", async () => {
  const producer = producerWith(new HttpRenderProvider({ apiBaseUrl: "", apiKey: "", timeoutMs: 10 }));
  await assert.rejects(producer.start(validInput()), (error) => error.code === "RENDER_NOT_CONFIGURED");
});

test("sends provider credentials and idempotency only on the server", async () => {
  let call;
  const provider = new HttpRenderProvider({
    apiBaseUrl: "https://render.example.test/v1",
    apiKey: "server-secret",
    fetchImpl: async (url, options) => {
      call = { url, options };
      return { ok: true, text: async () => JSON.stringify({ jobId: "provider-http", status: "queued", progress: 2 }) };
    },
  });
  const producer = producerWith(provider);
  await producer.start(validInput());
  assert.equal(call.url, "https://render.example.test/v1/renders");
  assert.equal(call.options.headers.Authorization, "Bearer server-secret");
  assert.match(call.options.headers["Idempotency-Key"], /^[a-f0-9]{64}$/);
  assert.doesNotMatch(call.options.body, /server-secret/);
});

test("converts the approved storyboard into a portrait Shotstack timeline", () => {
  const edit = toShotstackEdit({ storyboard: approvedRecord().storyboard, format: "9:16" });
  assert.equal(edit.timeline.tracks[0].clips.length, 2);
  assert.deepEqual(edit.timeline.tracks[0].clips.map(({ start, length }) => ({ start, length })), [
    { start: 0, length: 30 }, { start: 30, length: 30 },
  ]);
  assert.match(edit.timeline.tracks[0].clips[0].asset.text, /First approved scene/);
  assert.deepEqual(edit.output.size, { width: 720, height: 1280 });
  assert.equal(edit.output.format, "mp4");
});

test("uses Shotstack authentication and normalizes its asynchronous states", async () => {
  const calls = [];
  const responses = [
    { success: true, response: { id: "shotstack-job", message: "Render Successfully Queued" } },
    { success: true, response: { id: "shotstack-job", status: "rendering" } },
    {
      success: true,
      response: {
        id: "shotstack-job", status: "done", updated: "2026-07-19T03:00:00Z",
        url: "https://cdn.shotstack.io/example/render.mp4",
      },
    },
  ];
  const provider = new ShotstackRenderProvider({
    apiUrl: "http://127.0.0.1:9999/edit/stage/render",
    apiKey: "shotstack-stage-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const body = responses.shift();
      return { ok: true, text: async () => JSON.stringify(body) };
    },
  });
  const started = await provider.startRender({ storyboard: approvedRecord().storyboard, format: "9:16" });
  const running = await provider.getStatus(started.jobId);
  const completed = await provider.getStatus(started.jobId);
  assert.equal(started.status, "queued");
  assert.equal(running.status, "running");
  assert.equal(completed.status, "completed");
  assert.equal(completed.videoUrl, "https://cdn.shotstack.io/example/render.mp4");
  assert.equal(calls[0].options.headers["x-api-key"], "shotstack-stage-key");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[1].url, "http://127.0.0.1:9999/edit/stage/render/shotstack-job?data=false");
  assert.doesNotMatch(calls[0].options.body, /shotstack-stage-key/);
});

test("selects Shotstack independently from the LLM provider", () => {
  const provider = createRenderProvider({
    providerName: "shotstack",
    shotstackOptions: { apiUrl: "https://api.shotstack.io/edit/stage/render", apiKey: "stage-key" },
  });
  assert.ok(provider instanceof ShotstackRenderProvider);
});

test("returns 404 for an unknown render job", async () => {
  const producer = producerWith(queuedProvider());
  const result = await request(createApp({ videoProducer: producer }), "GET", "/api/videos/render-missing/status");
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, "RENDER_NOT_FOUND");
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
  console.log(`\n${tests.length - failures}/${tests.length} video producer tests passed`);
  if (failures) process.exitCode = 1;
})();
