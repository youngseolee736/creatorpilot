const crypto = require("crypto");

function createRequestId() {
  return `req_${crypto.randomBytes(8).toString("hex")}`;
}

module.exports = { createRequestId };
