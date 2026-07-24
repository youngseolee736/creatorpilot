const assert = require("assert");
const http = require("http");
const AbortController = require("abort-controller");
const { createApp } = require("../src/app");
const { TranscriptService } = require("../src/services/transcript");
const { LocalYouTubeTranscriptProvider } = require("../src/services/transcript/local-youtube-transcript-provider");
const { HostedTranscriptProvider } = require("../src/services/transcript/hosted-transcript-provider");
const { TranscriptApiProvider } = require("../src/services/transcript/transcriptapi-provider");
const { normalizeSegments } = require("../src/services/transcript/normalize-transcript");
const { AppError } = require("../src/middleware/error-handler");
const { extractYouTubeVideo } = require("../src/utils/youtube-url");

const tests = [];
function test(name, callback) { tests.push({ name, callback }); }

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => typeof body === "string" ? body : JSON.stringify(body),
  };
}

function serviceWith(fetchImpl, timeoutMs = 50) {
  return new TranscriptService({
    providerName: "hosted",
    hostedProvider: new HostedTranscriptProvider({
      apiUrl: "https://provider.example/transcript",
      fetchImpl,
      timeoutMs,
      AbortControllerImpl: AbortController,
    }),
  });
}

function localService(fetchTranscriptImpl, timeoutMs = 50) {
  return new TranscriptService({
    providerName: "local",
    localProvider: new LocalYouTubeTranscriptProvider({
      fetchTranscriptImpl,
      fetchImpl: async () => response(200, {}),
      timeoutMs,
      AbortControllerImpl: AbortController,
    }),
  });
}

async function request(app, path, body, headers = {}) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const payload = body == null ? null : JSON.stringify(body);

  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: "127.0.0.1",
        port: server.address().port,
        path,
        method: body == null ? "GET" : "POST",
        headers: {
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      }, (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
      });
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const validRequest = {
  projectId: "project-test",
  youtubeUrl: "https://youtu.be/jNQXAC9IVRw",
  targetLanguage: "English",
};

test("reports backend health", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})) });
  const result = await request(app, "/api/health", null);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok", service: "creatorpilot-backend" });
});

test("accepts supported YouTube URL formats and preserves the video ID", () => {
  assert.deepEqual(extractYouTubeVideo("https://www.youtube.com/watch?v=jNQXAC9IVRw"), {
    videoId: "jNQXAC9IVRw",
    canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  });
  assert.equal(extractYouTubeVideo("https://youtube.com/shorts/jNQXAC9IVRw").videoId, "jNQXAC9IVRw");
});

test("returns 400 when the YouTube URL is missing", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})) });
  const result = await request(app, "/api/transcripts/extract", { projectId: "project-test", targetLanguage: "English" });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_YOUTUBE_URL");
  assert.equal(result.body.error.retryable, false);
});

test("returns 400 for an unsupported URL", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})) });
  const result = await request(app, "/api/transcripts/extract", { ...validRequest, youtubeUrl: "https://example.com/watch?v=jNQXAC9IVRw" });
  assert.equal(result.status, 400);
  assert.equal(result.body.error.code, "INVALID_YOUTUBE_URL");
});

test("maps transcript unavailable to a user-safe 404", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(404, { detail: "No transcript" })) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 404);
  assert.equal(result.body.error.code, "TRANSCRIPT_UNAVAILABLE");
  assert.equal(result.body.error.retryable, false);
});

test("maps provider rate limiting to 429 even when the error body is not JSON", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(429, "Too Many Requests")) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 429);
  assert.equal(result.body.error.code, "PROVIDER_RATE_LIMITED");
  assert.equal(result.body.error.retryable, true);
});

test("aborts a slow provider and returns 504", async () => {
  const fetchImpl = (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
  const app = createApp({ transcriptService: serviceWith(fetchImpl, 5) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 504);
  assert.equal(result.body.error.code, "TRANSCRIPT_TIMEOUT");
  assert.equal(result.body.error.retryable, true);
});

test("rejects malformed upstream JSON with 502", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, "not-json")) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "TRANSCRIPT_PROVIDER_ERROR");
});

test("normalizes a successful provider transcript into the CreatorPilot contract", async () => {
  let providerRequest;
  const fetchImpl = async (url, options) => {
    providerRequest = { url, options };
    return response(200, {
      status: "success",
      title: "Me at the zoo",
      language: "en",
      transcript: [
        { start: 0, duration: 2.4, text: "All right, so here we are." },
        { start: 2.4, duration: 3.6, text: "The cool thing about these elephants is their trunks." },
      ],
    });
  };
  const app = createApp({ transcriptService: serviceWith(fetchImpl) });
  const result = await request(app, "/api/transcripts/extract", validRequest, { Origin: "http://127.0.0.1:4173" });
  assert.equal(result.status, 200);
  assert.match(result.body.requestId, /^req_/);
  assert.deepEqual(result.body.data, {
    transcriptId: "tr_jNQXAC9IVRw",
    source: "youtube_captions",
    title: "Me at the zoo",
    text: "All right, so here we are. The cool thing about these elephants is their trunks.",
    language: "en",
    wordCount: 15,
    estimatedDuration: 6,
    segments: [
      { start: 0, end: 2.4, text: "All right, so here we are." },
      { start: 2.4, end: 6, text: "The cool thing about these elephants is their trunks." },
    ],
  });
  assert.equal(providerRequest.url, "https://provider.example/transcript");
  assert.deepEqual(JSON.parse(providerRequest.options.body), { url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" });
  assert.equal(result.headers["access-control-allow-origin"], "http://127.0.0.1:4173");
});

test("fetches TranscriptAPI captions with server-side authentication and caches the result", async () => {
  const calls = [];
  const provider = new TranscriptApiProvider({
    apiKey: "test-transcriptapi-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, {
        video_id: "jNQXAC9IVRw",
        language: "en",
        metadata: { title: "Me at the zoo" },
        transcript: [
          { start: 0, duration: 2.4, text: "All right, so here we are." },
          { start: 2.4, duration: 3.6, text: "These elephants have long trunks." },
        ],
      });
    },
    AbortControllerImpl: AbortController,
  });
  const context = {
    videoId: "jNQXAC9IVRw",
    canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  };

  const [first, concurrent] = await Promise.all([provider.extract(context), provider.extract(context)]);
  const second = await provider.extract(context);
  const requestUrl = new URL(calls[0].url);

  assert.equal(calls.length, 1);
  assert.deepEqual(concurrent, first);
  assert.deepEqual(second, first);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-transcriptapi-key");
  assert.equal(requestUrl.origin + requestUrl.pathname, "https://transcriptapi.com/api/v2/youtube/transcript");
  assert.equal(requestUrl.searchParams.get("video_url"), context.canonicalUrl);
  assert.equal(requestUrl.searchParams.get("include_timestamp"), "true");
  assert.equal(requestUrl.searchParams.get("send_metadata"), "true");
  assert.equal(requestUrl.searchParams.has("language"), false);
  assert.equal(first.title, "Me at the zoo");
  assert.equal(first.estimatedDuration, 6);
});

test("passes an explicit preferred caption language to TranscriptAPI", async () => {
  let requestUrl;
  const provider = new TranscriptApiProvider({
    apiKey: "test-key",
    fetchImpl: async (url) => {
      requestUrl = new URL(url);
      return response(200, { transcript: [{ start: 0, duration: 2, text: "한국어 자막 추출 테스트입니다." }] });
    },
    AbortControllerImpl: AbortController,
  });
  await provider.extract({
    videoId: "jNQXAC9IVRw",
    canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    preferredCaptionLanguage: "Korean",
  });
  assert.equal(requestUrl.searchParams.get("language"), "ko");
});

test("maps TranscriptAPI configuration, credit, and rate-limit failures", async () => {
  const context = { videoId: "jNQXAC9IVRw", canonicalUrl: validRequest.youtubeUrl };
  await assert.rejects(
    new TranscriptApiProvider({ apiKey: "" }).extract(context),
    (error) => error.code === "TRANSCRIPT_PROVIDER_NOT_CONFIGURED" && error.retryable === false,
  );
  for (const [status, code, retryable] of [
    [402, "TRANSCRIPT_CREDITS_EXHAUSTED", false],
    [404, "TRANSCRIPT_UNAVAILABLE", false],
    [429, "PROVIDER_RATE_LIMITED", true],
    [503, "TRANSCRIPT_PROVIDER_ERROR", true],
  ]) {
    const provider = new TranscriptApiProvider({
      apiKey: "test-key",
      fetchImpl: async () => response(status, { detail: "provider detail must not leak" }),
      AbortControllerImpl: AbortController,
    });
    await assert.rejects(provider.extract(context), (error) => error.code === code && error.retryable === retryable);
  }
});

test("rejects a browser origin outside the configured frontend", async () => {
  const app = createApp({ transcriptService: serviceWith(async () => response(200, {})), frontendOrigin: "http://127.0.0.1:4173" });
  const result = await request(app, "/api/transcripts/extract", validRequest, { Origin: "https://untrusted.example" });
  assert.equal(result.status, 403);
  assert.equal(result.body.error.code, "ORIGIN_NOT_ALLOWED");
});

test("extracts and normalizes a successful local-library transcript", async () => {
  let receivedVideoId;
  const app = createApp({ transcriptService: localService(async (videoId) => {
    receivedVideoId = videoId;
    return [
      { offset: 1200, duration: 2160, text: "All right, so here we are.", lang: "en" },
      { offset: 3360, duration: 1800, text: "These elephants have long trunks.", lang: "en" },
    ];
  }) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 200);
  assert.equal(receivedVideoId, "jNQXAC9IVRw");
  assert.equal(result.body.data.text, "All right, so here we are. These elephants have long trunks.");
  assert.equal(result.body.data.language, "en");
  assert.equal(result.body.data.title, null);
  assert.deepEqual(result.body.data.segments[0], { start: 1.2, end: 3.36, text: "All right, so here we are." });
});

test("normalizes segment end from start plus duration", () => {
  assert.deepEqual(normalizeSegments([{ start: 2.4, duration: 3.6, text: "A complete transcript segment." }]), [
    { start: 2.4, end: 6, text: "A complete transcript segment." },
  ]);
});

test("concatenates local transcript segment text", async () => {
  const result = await localService(async () => [
    { start: 0, duration: 1, text: "First useful sentence." },
    { start: 1, duration: 1, text: "Second useful sentence." },
  ]).extract({ videoId: "jNQXAC9IVRw" });
  assert.equal(result.text, "First useful sentence. Second useful sentence.");
});

test("uses null when local transcript language metadata is missing", async () => {
  const result = await localService(async () => [
    { start: 0, duration: 2, text: "Transcript without language metadata." },
  ]).extract({ videoId: "jNQXAC9IVRw" });
  assert.equal(result.language, null);
});

for (const failure of [
  ["captions disabled", "Transcript is disabled on this video", 404, "TRANSCRIPT_UNAVAILABLE", false],
  ["no transcript found", "No transcripts are available for this video", 404, "TRANSCRIPT_UNAVAILABLE", false],
  ["video unavailable", "The video is no longer available", 404, "VIDEO_NOT_FOUND", false],
  ["YouTube request blocked", "YouTube request blocked with status code 403", 502, "TRANSCRIPT_PROVIDER_ERROR", true],
]) {
  test(`maps local-library ${failure[0]}`, async () => {
    const app = createApp({ transcriptService: localService(async () => { throw new Error(failure[1]); }) });
    const result = await request(app, "/api/transcripts/extract", validRequest);
    assert.equal(result.status, failure[2]);
    assert.equal(result.body.error.code, failure[3]);
    assert.equal(result.body.error.retryable, failure[4]);
  });
}

test("rejects an unexpected local-library result shape", async () => {
  const app = createApp({ transcriptService: localService(async () => ({ unexpected: true })) });
  const result = await request(app, "/api/transcripts/extract", validRequest);
  assert.equal(result.status, 502);
  assert.equal(result.body.error.code, "TRANSCRIPT_PROVIDER_ERROR");
  assert.equal(result.body.error.retryable, true);
});

for (const requestField of ["url", "video_url"]) {
  test(`hosted provider supports the ${requestField} adapter schema`, async () => {
    let requestBody;
    const provider = new HostedTranscriptProvider({
      requestField,
      fetchImpl: async (url, options) => {
        requestBody = JSON.parse(options.body);
        return response(200, { transcript: [{ start: 0, duration: 2, text: "Hosted adapter transcript works." }] });
      },
      AbortControllerImpl: AbortController,
    });
    const result = await provider.extract({ videoId: "jNQXAC9IVRw", canonicalUrl: validRequest.youtubeUrl });
    assert.deepEqual(requestBody, { [requestField]: validRequest.youtubeUrl });
    assert.equal(result.text, "Hosted adapter transcript works.");
  });
}

test("selects the configured transcript provider", async () => {
  const calls = [];
  const localProvider = { extract: async () => { calls.push("local"); return { source: "local" }; } };
  const hostedProvider = { extract: async () => { calls.push("hosted"); return { source: "hosted" }; } };
  const transcriptApiProvider = { extract: async () => { calls.push("transcriptapi"); return { source: "transcriptapi" }; } };
  assert.deepEqual(await new TranscriptService({ providerName: "local", localProvider, hostedProvider, transcriptApiProvider }).extract({}), { source: "local" });
  assert.deepEqual(await new TranscriptService({ providerName: "hosted", localProvider, hostedProvider, transcriptApiProvider }).extract({}), { source: "hosted" });
  assert.deepEqual(await new TranscriptService({ providerName: "transcriptapi", localProvider, hostedProvider, transcriptApiProvider }).extract({}), { source: "transcriptapi" });
  assert.deepEqual(calls, ["local", "hosted", "transcriptapi"]);
});

test("keeps hosted fallback disabled by default", async () => {
  let hostedCalls = 0;
  const failure = new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "temporary", true);
  const service = new TranscriptService({
    providerName: "local",
    localProvider: { extract: async () => { throw failure; } },
    hostedProvider: { extract: async () => { hostedCalls += 1; } },
  });
  await assert.rejects(service.extract({}), (error) => error === failure);
  assert.equal(hostedCalls, 0);
});

test("uses hosted fallback only when explicitly enabled", async () => {
  const service = new TranscriptService({
    providerName: "local",
    fallbackEnabled: true,
    localProvider: { extract: async () => { throw new AppError(502, "TRANSCRIPT_PROVIDER_ERROR", "temporary", true); } },
    hostedProvider: { extract: async () => ({ source: "hosted-fallback" }) },
  });
  assert.deepEqual(await service.extract({}), { source: "hosted-fallback" });
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
  console.log(`\n${tests.length - failures}/${tests.length} backend tests passed`);
  if (failures) process.exitCode = 1;
})();
