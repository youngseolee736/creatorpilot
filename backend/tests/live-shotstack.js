const assert = require("assert");
require("dotenv").config();
const { ShotstackRenderProvider } = require("../src/services/render/shotstack-render-provider");

const apiUrl = String(process.env.SHOTSTACK_API_URL || "").trim();
const apiKey = String(process.env.SHOTSTACK_API_KEY || "").trim();
if (!apiUrl || !apiKey) {
  console.log("SKIP: Live Shotstack test requires SHOTSTACK_API_URL and SHOTSTACK_API_KEY.");
  process.exit(0);
}
if (!/\/edit\/stage\/render$/u.test(apiUrl) && process.env.LIVE_SHOTSTACK_PRODUCTION !== "1") {
  console.log("SKIP: Live Shotstack test uses Stage by default. Set LIVE_SHOTSTACK_PRODUCTION=1 to authorize Production credits.");
  process.exit(0);
}

(async () => {
  const provider = new ShotstackRenderProvider();
  let status = await provider.startRender({
    projectId: "project-live-shotstack",
    format: "9:16",
    storyboard: {
      scenes: [{ number: 1, start: 0, duration: 2, caption: "CreatorPilot Shotstack connection verified" }],
    },
  });
  for (let poll = 0; poll < 60 && status.status !== "completed" && status.status !== "failed"; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    status = await provider.getStatus(status.jobId);
  }
  assert.equal(status.status, "completed");
  assert.match(status.videoUrl, /^https:/u);
  console.log({ status: status.status, videoUrl: status.videoUrl });
})().catch((error) => {
  console.error("Live Shotstack test failed:", error.code || error.name || "ERROR", error.message);
  process.exitCode = 1;
});
