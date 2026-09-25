const SIKKA_BASE = "https://api.sikka.fun/api/v1";
const MAX_TOKENS = 100;
const TRADES_PER_TOKEN = 25;
const CONCURRENCY = 20;

function first(...values) {
  return values.find(v => v !== undefined && v !== null && v !== "");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  if (value && Array.isArray(value.tokens)) return value.tokens;
  if (value && Array.isArray(value.results)) return value.results;
  if (value && Array.isArray(value.data?.tokens)) return value.data.tokens;
  return [];
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Sikka returned non-JSON (${response.status})`);
  }

  if (!response.ok) {
    const message =
      first(json?.message, json?.error, json?.detail) ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }

  return json;
}

function normalizeToken(token) {
  const address = first(
    token?.address,
    token?.token_ca,
    token?.tokenCA,
    token?.contract,
    token?.contract_address,
    token?.ca
  );

  return {
    address,
    name: first(token?.name, token?.token_name, token?.metadata?.name, "Unknown"),
    symbol: first(
      token?.symbol,
      token?.ticker,
      token?.token_symbol,
      token?.metadata?.symbol,
      "TOKEN"
    ),
    image_url: first(
      token?.image_url,
      token?.image,
      token?.logo,
      token?.logo_url,
      token?.metadata?.image,
      token?.metadata?.image_url,
      ""
    )
  };
}

function normalizeTrade(trade, token) {
  const timestamp = Number(
    first(trade?.t, trade?.timestamp, trade?.time, trade?.block_time, 0)
  );

  const type = String(
    first(trade?.type, trade?.side, trade?.action, "unknown")
  ).toLowerCase();

  return {
    tx: first(trade?.tx, trade?.hash, trade?.transaction_hash, ""),
    type,
    user: first(trade?.user, trade?.trader, trade?.wallet, ""),
    price: String(first(trade?.price, trade?.token_price, "0")),
    shm: String(first(trade?.shm, trade?.shm_amount, trade?.quote_amount, "0")),
    amt: String(first(trade?.amt, trade?.amount, trade?.token_amount, "0")),
    block: Number(first(trade?.block, trade?.block_number, 0)),
    t: timestamp,
    timestamp,
    token_ca: token.address,
    name: token.name,
    ticker: token.symbol,
    symbol: token.symbol,
    image_url: token.image_url
  };
}

async function fetchTokenTrades(token) {
  if (!token.address) return [];

  try {
    const url =
      `${SIKKA_BASE}/tokens/${encodeURIComponent(token.address)}/trades` +
      `?limit=${TRADES_PER_TOKEN}`;

    const result = await getJson(url);

    // Sikka's documented response is { data: [...], next_cursor, has_more }.
    const trades = Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result)
        ? result
        : [];

    return trades.map(t => normalizeTrade(t, token));
  } catch (error) {
    // One broken token must not break the whole live-trades dashboard.
    return [];
  }
}

async function mapWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;

      try {
        results[index] = await worker(items[index], index);
      } catch {
        results[index] = [];
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runner()
  );

  await Promise.all(workers);
  return results;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    // Sikka token directory. We deliberately use the token directory,
    // rather than /tokens/movers, so the trades belong to the actual
    // token contract we query.
    const tokenResult = await getJson(`${SIKKA_BASE}/tokens?limit=${MAX_TOKENS}`);

    const rawTokens = asArray(tokenResult);

    const tokens = rawTokens
      .map(normalizeToken)
      .filter(t => t.address)
      .slice(0, MAX_TOKENS);

    if (!tokens.length) {
      return res.status(200).json({
        success: true,
        trades: [],
        totalTrades: 0,
        tokensTracked: 0,
        buyTrades: 0,
        sellTrades: 0,
        checkedAt: new Date().toISOString(),
        warning: "Sikka /tokens returned no token records"
      });
    }

    const tradeLists = await mapWithConcurrency(
      tokens,
      token => fetchTokenTrades(token),
      CONCURRENCY
    );

    const allTrades = tradeLists.flat();

    // Deduplicate transactions when the API exposes a tx hash.
    const seen = new Set();
    const deduped = [];

    for (const trade of allTrades) {
      const key = trade.tx
        ? `${trade.tx}:${trade.token_ca}`
        : `${trade.token_ca}:${trade.block}:${trade.t}:${trade.type}:${trade.price}:${trade.amt}`;

      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(trade);
    }

    // Newest block time first.
    deduped.sort((a, b) => {
      const bt = Number(b.t || b.timestamp || 0) - Number(a.t || a.timestamp || 0);
      if (bt !== 0) return bt;

      return String(b.tx || "").localeCompare(String(a.tx || ""));
    });

    const trades = deduped.slice(0, 100);

    const buyTrades = trades.filter(t => t.type === "buy").length;
    const sellTrades = trades.filter(t => t.type === "sell").length;

    return res.status(200).json({
      success: true,
      trades,
      totalTrades: trades.length,
      tokensTracked: tokens.length,
      buyTrades,
      sellTrades,
      checkedAt: new Date().toISOString(),
      source: "Sikka.fun API: /tokens + /tokens/{token_ca}/trades"
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error?.message || "Unable to load Sikka trades",
      trades: [],
      totalTrades: 0,
      tokensTracked: 0,
      buyTrades: 0,
      sellTrades: 0,
      checkedAt: new Date().toISOString()
    });
  }
}
