const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "backend", ".env") });

const { createApp } = require("./backend/src/app");

module.exports = createApp();
