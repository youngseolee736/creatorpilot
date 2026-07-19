const { HttpRenderProvider } = require("./http-render-provider");

function createRenderProvider(options = {}) {
  if (options.provider) return options.provider;
  return new HttpRenderProvider(options.httpOptions || options);
}

module.exports = { createRenderProvider, HttpRenderProvider };
