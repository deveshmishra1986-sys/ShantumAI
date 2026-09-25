const SIKKA_BASE_URL = "https://api.sikka.fun/api/v1";

const MAX_TOKENS = 50;
const TRADES_PER_TOKEN = 1000;
const LATEST_TRADES = 30;
const CONCURRENCY = 8;

export default async function handler(req, res) {
  try {
    const shmUsd = await getShmUsd();

    const moversResult = await fetchJson(`${SIKKA_BASE_URL}/tokens/movers`);
    const movers = extractArray(
      moversResult?.data?.movers,
      moversResult?.movers,
      moversResult?.data
    )
      .filter(t => t && (t.token_ca || t.contract || t.address))
      .slice(0, MAX_TOKENS);

    if (!movers.length) {
      return res.status(200).json({
        success: true,
        tokenCount: 0,
        totalTradeCount: 0,
        trades: [],
        tokens: [],
        checkedAt: new Date().toISOString()
      });
    }

    const results = await mapWithConcurrency(movers, async fallbackToken => {
      const address =
        fallbackToken.token_ca ||
        fallbackToken.contract ||
        fallbackToken.address;

      let tokenInfo = fallbackToken;
      let rawTrades = [];

      try {
        const tokenResult = await fetchJson(
          `${SIKKA_BASE_URL}/tokens/${encodeURIComponent(address)}`
        );
        tokenInfo =
          tokenResult?.data?.token ||
          tokenResult?.token ||
          (tokenResult?.data && !Array.isArray(tokenResult.data)
            ? tokenResult.data
            : null) ||
          fallbackToken;
      } catch (e) {
        console.error(`Token info error ${address}:`, e.message);
      }

      try {
        const tradeResult = await fetchJson(
          `${SIKKA_BASE_URL}/tokens/${encodeURIComponent(address)}/trades?limit=${TRADES_PER_TOKEN}`
        );
        rawTrades = extractTrades(tradeResult);
      } catch (e) {
        console.error(`Trade error ${address}:`, e.message);
      }

      const token = normalizeToken(tokenInfo, fallbackToken, shmUsd);

      const trades = rawTrades
        .map(t => normalizeTrade(t, token, shmUsd))
        .filter(t =>
          t.timestamp > 0 &&
          (t.type === "buy" || t.type === "sell")
        )
        .sort((a, b) => b.timestamp - a.timestamp);

      // If Sikka does not provide these all-time metrics, use the
      // returned trade history to produce useful per-token values.
      if (!Number.isFinite(token.txns)) {
        token.txns = trades.length;
      }

      if (!Number.isFinite(token.volumeUsd)) {
        token.volumeUsd = trades.reduce(
          (sum, t) => sum + (Number.isFinite(t.volumeUsd) ? t.volumeUsd : 0),
          0
        );
      }

      if (!Number.isFinite(token.traders)) {
        const wallets = new Set(
          trades
            .map(t => t.wallet)
            .filter(Boolean)
            .map(v => String(v).toLowerCase())
        );
        token.traders = wallets.size || null;
      }

      return { token, trades };
    }, CONCURRENCY);

    const tokens = results.map(r => r.token);

    const allTrades = results
      .flatMap(r => r.trades)
      .sort((a, b) => b.timestamp - a.timestamp);

    const latestTrades = allTrades.slice(0, LATEST_TRADES);

    return res.status(200).json({
      success: true,
      checkedAt: new Date().toISOString(),
      tokenCount: tokens.length,
      totalTradeCount: allTrades.length,
      limit: LATEST_TRADES,
      sort: "timestamp_desc",
      tokens,
      trades: latestTrades
    });
  } catch (error) {
    console.error("Sikka latest 30 error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      tokenCount: 0,
      totalTradeCount: 0,
      tokens: [],
      trades: []
    });
  }
}

async function fetchJson(url) {
  const r = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function extractArray(...values) {
  for (const v of values) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

function extractTrades(result) {
  return extractArray(
    result?.data,
    result?.data?.data,
    result?.data?.trades,
    result?.trades,
    result?.items,
    result?.data?.items
  );
}

function firstNumber(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

function normalizeToken(source, fallback, shmUsd) {
  const s = source || {};
  const f = fallback || {};

  const tokenPriceShm = firstNumber(
    s.price,
    s.price_shm,
    s.priceShm,
    s.token_price,
    s.tokenPrice,
    f.price,
    f.price_shm,
    f.priceShm
  );

  let priceUsd = firstNumber(
    s.price_usd,
    s.priceUsd,
    s.usd_price,
    s.usdPrice,
    f.price_usd,
    f.priceUsd
  );

  if (!Number.isFinite(priceUsd) &&
      Number.isFinite(tokenPriceShm) &&
      Number.isFinite(shmUsd)) {
    priceUsd = tokenPriceShm * shmUsd;
  }

  const supply = firstNumber(
    s.circulating_supply,
    s.circulatingSupply,
    s.current_supply,
    s.currentSupply,
    s.total_supply,
    s.totalSupply,
    s.supply,
    f.circulating_supply,
    f.circulatingSupply,
    f.current_supply,
    f.currentSupply,
    f.total_supply,
    f.totalSupply,
    f.supply
  );

  let marketCapUsd = firstNumber(
    s.market_cap_usd,
    s.marketCapUsd,
    s.market_cap_USD,
    s.marketCapUSD,
    f.market_cap_usd,
    f.marketCapUsd
  );

  // Sikka may expose market_cap without a currency suffix.
  // On Sikka token markets the native quote is SHM, so convert
  // that value to USD when needed.
  const rawMarketCap = firstNumber(
    s.market_cap,
    s.marketCap,
    s.mcap,
    s.mkt_cap,
    f.market_cap,
    f.marketCap,
    f.mcap
  );

  const capCurrency = String(
    s.market_cap_currency ||
    s.marketCapCurrency ||
    s.market_cap_currency_code ||
    s.currency ||
    ""
  ).toUpperCase();

  if (!Number.isFinite(marketCapUsd) && Number.isFinite(rawMarketCap)) {
    if (capCurrency === "USD" || capCurrency === "$") {
      marketCapUsd = rawMarketCap;
    } else if (Number.isFinite(shmUsd)) {
      marketCapUsd = rawMarketCap * shmUsd;
    } else {
      marketCapUsd = rawMarketCap;
    }
  }

  if (!Number.isFinite(marketCapUsd) &&
      Number.isFinite(priceUsd) &&
      Number.isFinite(supply)) {
    marketCapUsd = priceUsd * supply;
  }

  const txns = firstNumber(
    s.txns,
    s.transactions,
    s.total_transactions,
    s.totalTransactions,
    s.total_trades,
    s.totalTrades,
    s.trade_count,
    s.tradeCount,
    s.trades_count,
    s.tradesCount,
    s.txn_count,
    s.txnCount
  );

  const volumeUsd = firstNumber(
    s.volume_usd,
    s.volumeUsd,
    s.usd_volume,
    s.usdVolume,
    s.total_volume_usd,
    s.totalVolumeUsd,
    s.volume_24h_usd,
    s.volume24hUsd
  );

  const traders = firstNumber(
    s.traders,
    s.unique_traders,
    s.uniqueTraders,
    s.trader_count,
    s.traderCount,
    s.unique_users,
    s.uniqueUsers
  );

  return {
    token_ca:
      s.token_ca || s.contract || s.address ||
      f.token_ca || f.contract || f.address || "",
    name: s.name || f.name || "Unknown",
    ticker: s.ticker || s.symbol || f.ticker || f.symbol || "",
    image_url: s.image_url || s.image || s.logo ||
      f.image_url || f.image || f.logo || "",
    marketCapUsd: Number.isFinite(marketCapUsd) ? marketCapUsd : null,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    priceShm: Number.isFinite(tokenPriceShm) ? tokenPriceShm : null,
    txns: Number.isFinite(txns) ? txns : null,
    volumeUsd: Number.isFinite(volumeUsd) ? volumeUsd : null,
    traders: Number.isFinite(traders) ? traders : null
  };
}

function normalizeTrade(trade, token, shmUsd) {
  const timestamp = getTimestamp(trade);

  const typeRaw = String(
    trade.type ?? trade.side ?? trade.action ?? ""
  ).toLowerCase();

  const type = typeRaw.includes("buy")
    ? "buy"
    : typeRaw.includes("sell")
      ? "sell"
      : typeRaw;

  const priceShm = firstNumber(
    trade.price,
    trade.price_shm,
    trade.priceShm,
    trade.token_price,
    trade.tokenPrice
  );

  let priceUsd = firstNumber(
    trade.price_usd,
    trade.priceUsd,
    trade.usd_price,
    trade.usdPrice
  );

  if (!Number.isFinite(priceUsd) &&
      Number.isFinite(priceShm) &&
      Number.isFinite(shmUsd)) {
    priceUsd = priceShm * shmUsd;
  }

  const volumeShm = firstNumber(
    trade.volume,
    trade.amount,
    trade.shm_amount,
    trade.shmAmount,
    trade.amount_shm,
    trade.amountShm,
    trade.value,
    trade.value_shm,
    trade.valueShm
  );

  let volumeUsd = firstNumber(
    trade.volume_usd,
    trade.volumeUsd,
    trade.usd_volume,
    trade.usdVolume,
    trade.trade_value_usd,
    trade.tradeValueUsd,
    trade.value_usd,
    trade.valueUsd
  );

  if (!Number.isFinite(volumeUsd) &&
      Number.isFinite(volumeShm) &&
      Number.isFinite(shmUsd)) {
    volumeUsd = volumeShm * shmUsd;
  }

  return {
    token_ca: token.token_ca,
    name: token.name,
    ticker: token.ticker,
    image_url: token.image_url,
    type,
    priceShm: Number.isFinite(priceShm) ? priceShm : null,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volumeShm: Number.isFinite(volumeShm) ? volumeShm : null,
    volumeUsd: Number.isFinite(volumeUsd) ? volumeUsd : null,
    timestamp,
    tx: trade.tx || trade.tx_hash || trade.txHash || trade.hash || "",
    wallet:
      trade.wallet ||
      trade.trader ||
      trade.maker ||
      trade.user ||
      trade.address ||
      ""
  };
}

function getTimestamp(trade) {
  let t = firstNumber(
    trade.t,
    trade.timestamp,
    trade.time,
    trade.created_at,
    trade.createdAt,
    trade.date
  );

  if (!Number.isFinite(t)) return 0;

  if (t > 0 && t < 100000000000) t *= 1000;
  return t;
}

async function getShmUsd() {
  try {
    const r = await fetch(
      "https://api.coinpaprika.com/v1/tickers/shm-shardeum",
      { cache: "no-store", headers: { Accept: "application/json" } }
    );
    if (!r.ok) throw new Error(`SHM HTTP ${r.status}`);
    const j = await r.json();
    const p = Number(j?.quotes?.USD?.price);
    return Number.isFinite(p) && p > 0 ? p : NaN;
  } catch (e) {
    console.error("SHM USD lookup failed:", e.message);
    return NaN;
  }
}

async function mapWithConcurrency(items, worker, concurrency) {
  const out = new Array(items.length);
  let next = 0;

  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = await worker(items[i], i);
      } catch (e) {
        console.error("Sikka worker error:", e.message);
        out[i] = { token: normalizeToken(items[i], items[i], NaN), trades: [] };
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runner()
    )
  );

  return out;
}
