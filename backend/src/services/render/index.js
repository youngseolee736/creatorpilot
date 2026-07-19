const { HttpRenderProvider } = require("./http-render-provider");
const { renderConfigurationError } = require("./render-errors");
const { ShotstackRenderProvider } = require("./shotstack-render-provider");

function createRenderProvider(options = {}) {
  if (options.provider) return options.provider;
  const providerName = String(options.providerName || process.env.RENDER_PROVIDER || "http").toLowerCase();
  if (providerName === "http") return new HttpRenderProvider(options.httpOptions || options);
  if (providerName === "shotstack") return new ShotstackRenderProvider(options.shotstackOptions || options);
  return {
    async startRender() { throw renderConfigurationError(); },
    async getStatus() { throw renderConfigurationError(); },
  };
}

module.exports = { createRenderProvider, HttpRenderProvider, ShotstackRenderProvider };
