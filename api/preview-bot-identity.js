/** TEMPORARY Preview-only token identity probe; remove after one verification. */
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Robots-Tag", "noindex");
  if (req.method !== "GET" || process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/v2-1-player-settings-menu") {
    res.statusCode = 404; return res.end('{"error":"not_found"}');
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { res.statusCode = 503; return res.end('{"configured":false}'); }
  try {
    const response = await fetch("https://api.telegram.org/bot" + token + "/getMe", {
      cache: "no-store", signal: AbortSignal.timeout(8000)
    });
    const data = await response.json();
    const username = typeof data?.result?.username === "string" ? data.result.username : null;
    res.statusCode = response.ok && data.ok ? 200 : 503;
    return res.end(JSON.stringify({
      configured: response.ok && Boolean(data.ok),
      matchesTestGwapBot: username?.toLowerCase() === "testgwap_bot"
    }));
  } catch {
    res.statusCode = 503;
    return res.end('{"configured":false,"reason":"bot_api_unreachable"}');
  }
}
