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

function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.trades)) return payload.data.trades;
  if (Array.isArray(payload?.trades)) return payload.trades;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
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

  // Sikka may return seconds. Convert to milliseconds.
  if (value > 0 && value < 100000000000) value *= 1000;

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
        console.error(error);
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
    // 1. Get active/moving tokens.
    const moversPayload = await fetchJson(
      `${SIKKA_BASE_URL}/tokens/movers`
    );

    const movers = extractArray(moversPayload)
      .filter(token => token?.token_ca || token?.address)
      .slice(0, MAX_TOKENS);

    // 2. Fetch trades for each token.
    // IMPORTANT: do NOT add ?limit=1000 here. The older Sikka endpoint
    // that was working on the site returned trades from the plain URL.
    const perToken = await mapWithConcurrency(
      movers,
      async token => {
        const tokenAddress = token.token_ca || token.address;
        const tradePayload = await fetchJson(
          `${SIKKA_BASE_URL}/tokens/${encodeURIComponent(tokenAddress)}/trades`
        );

        const rawTrades = extractArray(tradePayload);

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

    // 3. Merge every token's trades and sort strictly by date/time.
    const allTrades = perToken
      .flatMap(value => Array.isArray(value) ? value : [])
      .sort((a, b) => b.timestamp - a.timestamp);

    // 4. EXACTLY the latest 30 trades globally.
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
      trades: []
    });
  }
}
