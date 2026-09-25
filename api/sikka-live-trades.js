// api/sikka-live-trades.js
// Multi-token Sikka trade feed.
// Uses the documented:
//   GET /tokens?limit=50
//   GET /tokens/{token_ca}/trades?limit=25
//
// Sikka trade responses are NOT wrapped in a success envelope.

const BASE = "https://api.sikka.fun/api/v1";
const TOKEN_LIMIT = 50;
const TRADES_PER_TOKEN = 25;
const CONCURRENCY = 8;

async function getJson(url) {
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from Sikka (HTTP ${r.status})`);
  }
  if (!r.ok) {
    throw new Error(json?.error?.message || json?.message || `Sikka HTTP ${r.status}`);
  }
  return json;
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        output[i] = await worker(items[i], i);
      } catch (e) {
        output[i] = { error: e?.message || "request failed" };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runner)
  );
  return output;
}

export default async function handler(req, res) {
  try {
    const tokenResult = await getJson(`${BASE}/tokens?limit=${TOKEN_LIMIT}`);

    const tokenData = tokenResult?.data || {};
    const tokens = Array.isArray(tokenData.tokens)
      ? tokenData.tokens
      : [];

    const selectedTokens = tokens
      .filter(t => t?.token_ca)
      .slice(0, TOKEN_LIMIT);

    const results = await mapLimit(
      selectedTokens,
      CONCURRENCY,
      async token => {
        const ca = String(token.token_ca).toLowerCase();
        const tradeResult = await getJson(
          `${BASE}/tokens/${ca}/trades?limit=${TRADES_PER_TOKEN}`
        );

        const rows = Array.isArray(tradeResult?.data)
          ? tradeResult.data
          : [];

        return rows.map(trade => ({
          ...trade,
          token_ca: ca,
          name: token.name || token.ticker || "Unknown",
          ticker: token.ticker || "",
          image_url: token.image_url || "",
          token_created_at: token.created_at || null
        }));
      }
    );

    const trades = results
      .flatMap(x => Array.isArray(x) ? x : [])
      .filter(t => Number.isFinite(Number(t.t)) && Number(t.t) > 0);

    // A tx identifies a trade. Prevent duplicate rows if the same trade
    // is encountered more than once.
    const seen = new Set();
    const uniqueTrades = [];

    for (const trade of trades.sort((a,b) => Number(b.t) - Number(a.t))) {
      const tx = String(trade.tx || "");
      const key = tx || [
        trade.token_ca,
        trade.t,
        trade.type,
        trade.user,
        trade.price,
        trade.amt
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      uniqueTrades.push(trade);
    }

    return res.status(200).json({
      success: true,
      source: "sikka",
      tokens: selectedTokens,
      tokenCount: selectedTokens.length,
      trades: uniqueTrades.slice(0, 1500),
      count: Math.min(uniqueTrades.length, 1500),
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Multi-token Sikka trades error:", error);
    return res.status(502).json({
      success: false,
      error: error?.message || "Unable to load Sikka trades",
      source: "sikka"
    });
  }
}
