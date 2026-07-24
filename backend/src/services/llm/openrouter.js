function isOpenRouter(providerName, apiBaseUrl) {
  if (String(providerName || "").trim().toLowerCase() === "openrouter") return true;
  try {
    const hostname = new URL(String(apiBaseUrl || "")).hostname.toLowerCase();
    return hostname === "openrouter.ai" || hostname.endsWith(".openrouter.ai");
  } catch {
    return false;
  }
}

function openRouterHeaders({ providerName, apiBaseUrl, httpReferer, appTitle } = {}) {
  if (!isOpenRouter(providerName, apiBaseUrl)) return {};
  return {
    ...(String(httpReferer || "").trim() ? { "HTTP-Referer": String(httpReferer).trim() } : {}),
    ...(String(appTitle || "").trim() ? { "X-OpenRouter-Title": String(appTitle).trim() } : {}),
  };
}

module.exports = { isOpenRouter, openRouterHeaders };
