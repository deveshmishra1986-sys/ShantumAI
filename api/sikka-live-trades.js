const SIKKA_BASE_URL = "https://api.sikka.fun/api/v1";

const MAX_TOKENS = 50;
const MAX_TRADES_PER_TOKEN = 100;
const MAX_LATEST_TRADES = 30;
const CONCURRENCY = 8;

function firstNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Sikka's movers response is normally: { data: { movers: [...] } }
// Keep several fallbacks so a small response-shape change does not make
// the whole dashboard show 0 tokens.
function extractMovers(payload) {
  const candidates = [
    payload?.data?.movers,
    payload?.movers,
    payload?.data,
    payload?.items,
    payload?.data?.items
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function extractTrades(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.data?.trades,
    payload?.trades,
    payload?.items,
    payload?.data?.items
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function getTimestamp(trade) {
  let value = firstNumber(
    trade?.t,
    trade?.timestamp,
    trade?.time,
    trade?.created_at,
    trade?.createdAt,
    trade?.date
  );

  if (value === null) return 0;

  if (value > 0 && value < 100000000000) {
    value *= 1000;
  }

  return value;
}

function normalizeTrade(trade, token) {
  const timestamp = getTimestamp(trade);

  const rawType = String(
    trade?.type ??
    trade?.side ??
    trade?.action ??
    ""
  ).toLowerCase();

  let type = rawType;
  if (rawType.includes("buy")) type = "buy";
  else if (rawType.includes("sell")) type = "sell";

  const price = firstNumber(
    trade?.price,
    trade?.price_shm,
    trade?.priceShm,
    trade?.token_price,
    trade?.tokenPrice
  );

  const volumeShm = firstNumber(
    trade?.volume,
    trade?.amount,
    trade?.shm_amount,
    trade?.shmAmount,
    trade?.amount_shm,
    trade?.amountShm,
    trade?.value,
    trade?.value_shm,
    trade?.valueShm
  );

  return {
    name: token?.name || token?.token_name || token?.symbol || "Unknown",
    ticker: token?.ticker || token?.symbol || "",
    token_ca: token?.token_ca || token?.address || "",
    image_url: token?.image_url || token?.image || token?.logo || "",
    type,
    price,
    volume: volumeShm,
    timestamp,
    tx: trade?.tx || trade?.tx_hash || trade?.txHash || trade?.hash || "",
    wallet: trade?.wallet || trade?.trader || trade?.maker || trade?.user || ""
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Sikka HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

async function mapWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;

  async function runner() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;

      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        console.error("Sikka token trade fetch error:", error);
        results[index] = null;
      }
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
  try {
    // ------------------------------------------------------------
    // 1. Get active/moving tokens.
    // ------------------------------------------------------------
    const moversPayload = await fetchJson(
      `${SIKKA_BASE_URL}/tokens/movers`
    );

    const movers = extractMovers(moversPayload)
      .filter(token => token?.token_ca || token?.address)
      .slice(0, MAX_TOKENS);

    console.log(`Sikka movers found: ${movers.length}`);

    // ------------------------------------------------------------
    // 2. Fetch trades for every active token.
    // ------------------------------------------------------------
    const perToken = await mapWithConcurrency(
      movers,
      async token => {
        const tokenAddress = token.token_ca || token.address;

        // Do NOT add ?limit=1000 here. The plain endpoint is the
        // endpoint that was previously returning the trades on your site.
        const tradePayload = await fetchJson(
          `${SIKKA_BASE_URL}/tokens/${encodeURIComponent(tokenAddress)}/trades`
        );

        const rawTrades = extractTrades(tradePayload);

        const trades = rawTrades
          .map(trade => normalizeTrade(trade, token))
          .filter(trade =>
            trade.timestamp > 0 &&
            (trade.type === "buy" || trade.type === "sell")
          )
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, MAX_TRADES_PER_TOKEN);

        return trades;
      },
      CONCURRENCY
    );

    // ------------------------------------------------------------
    // 3. Merge all token trades and sort newest -> oldest.
    // ------------------------------------------------------------
    const allTrades = perToken
      .flatMap(value => Array.isArray(value) ? value : [])
      .sort((a, b) => b.timestamp - a.timestamp);

    // ------------------------------------------------------------
    // 4. Exactly the latest 30 trades globally.
    // ------------------------------------------------------------
    const latestTrades = allTrades.slice(0, MAX_LATEST_TRADES);

    return res.status(200).json({
      success: true,
      count: latestTrades.length,
      totalTradeCount: allTrades.length,
      tokenCount: movers.length,
      trades: latestTrades,
      sort: "timestamp_desc",
      limit: MAX_LATEST_TRADES,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Sikka latest 30 trades error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
      count: 0,
      totalTradeCount: 0,
      tokenCount: 0,
      trades: []
    });
  }
}
