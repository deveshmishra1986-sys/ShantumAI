const SIKKA_BASE = "https://api.sikka.fun/api/v1";

// FAST MODE: fewer trades per token + high parallelism.
// The token directory is normally ordered with recently active tokens first.
const MAX_TOKENS = 100;
const TRADES_PER_TOKEN = 20;
const CONCURRENCY = 40;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETURNED_TRADES = 100;

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

async function getJson(url, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
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
  } finally {
    clearTimeout(timer);
  }
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

  return {
    tx: first(trade?.tx, trade?.hash, trade?.transaction_hash, ""),
    type: String(first(trade?.type, trade?.side, trade?.action, "unknown")).toLowerCase(),
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
    const url = `${SIKKA_BASE}/tokens/${encodeURIComponent(token.address)}/trades?limit=${TRADES_PER_TOKEN}`;
    const result = await getJson(url);
    const trades = Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result)
        ? result
        : [];

    return trades.map(t => normalizeTrade(t, token));
  } catch {
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
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runner()
    )
  );

  return results;
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const started = Date.now();

  try {
    // One lightweight call to discover active tokens.
    const tokenResult = await getJson(`${SIKKA_BASE}/tokens?limit=${MAX_TOKENS}`, 5000);

    const tokens = asArray(tokenResult)
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
        elapsedMs: Date.now() - started
      });
    }

    // Fetch token trade feeds in parallel instead of waiting through batches.
    const tradeLists = await mapWithConcurrency(
      tokens,
      fetchTokenTrades,
      CONCURRENCY
    );

    const seen = new Set();
    const allTrades = [];

    for (const list of tradeLists) {
      for (const trade of list) {
        const key = trade.tx
          ? `${trade.tx}:${trade.token_ca}`
          : `${trade.token_ca}:${trade.block}:${trade.t}:${trade.type}:${trade.price}:${trade.amt}`;

        if (!seen.has(key)) {
          seen.add(key);
          allTrades.push(trade);
        }
      }
    }

    allTrades.sort((a, b) => {
      const timeDiff = Number(b.t || 0) - Number(a.t || 0);
      if (timeDiff !== 0) return timeDiff;
      return String(b.tx || "").localeCompare(String(a.tx || ""));
    });

    const trades = allTrades.slice(0, MAX_RETURNED_TRADES);

    return res.status(200).json({
      success: true,
      trades,
      totalTrades: trades.length,
      tokensTracked: tokens.length,
      buyTrades: trades.filter(t => t.type === "buy").length,
      sellTrades: trades.filter(t => t.type === "sell").length,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      mode: "fast-parallel"
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: error?.name === "AbortError"
        ? "Sikka API timed out. Please try again."
        : error?.message || "Unable to load Sikka trades",
      trades: [],
      totalTrades: 0,
      tokensTracked: 0,
      buyTrades: 0,
      sellTrades: 0,
      checkedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started
    });
  }
}
