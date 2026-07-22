require("dotenv").config();
const { createApp } = require("./app");

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const app = createApp();
const server = app.listen(port, host, () => {
  console.log(`CreatorPilot backend listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
