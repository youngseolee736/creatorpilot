require("dotenv").config();
const { createApp } = require("./app");

const port = Number(process.env.PORT || 8787);
const app = createApp();
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`CreatorPilot backend listening on http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
