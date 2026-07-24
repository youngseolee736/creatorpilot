const path = require("path");
const dotenv = require("dotenv");
require("express");

dotenv.config({ path: path.join(__dirname, "backend", ".env") });

const { createApp } = require("./backend/src/app");

module.exports = createApp();
