const SUPPORTED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,15}$/;

function extractYouTubeVideo(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password || !SUPPORTED_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const hostname = parsed.hostname.toLowerCase();
  const parts = parsed.pathname.split("/").filter(Boolean);
  let videoId = null;

  if (hostname === "youtu.be" || hostname === "www.youtu.be") {
    videoId = parts[0] || null;
  } else if (parsed.pathname === "/watch") {
    videoId = parsed.searchParams.get("v");
  } else if (["shorts", "embed", "live", "v"].includes(parts[0])) {
    videoId = parts[1] || null;
  }

  if (!VIDEO_ID_PATTERN.test(videoId || "")) return null;
  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

module.exports = { extractYouTubeVideo };
