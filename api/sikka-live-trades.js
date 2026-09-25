const SIKKA_BASE_URL = "https://api.sikka.fun/api/v1";
const SHANTUM_CONTRACT = "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

const MAX_TOKENS = 50;
const MAX_TRADES_PER_TOKEN = 100;
const MAX_LATEST_TRADES = 30;
const CONCURRENCY = 3;

function n(...values) {
  for (const v of values) {
    const x = Number(v);
    if (Number.isFinite(x)) return x;
  }
  return NaN;
}

function arr(...values) {
  for (const v of values) if (Array.isArray(v)) return v;
  return [];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson(url, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const r = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!r.ok) {
        throw new Error(`Sikka HTTP ${r.status}`);
      }

      return await r.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }

  throw lastError || new Error("Sikka request failed");
}

function extractMovers(payload) {
  return arr(
    payload?.data?.movers,
    payload?.movers,
    payload?.data?.items,
    payload?.items,
    payload?.data
  );
}

function extractTrades(payload) {
  return arr(
    payload?.data,
    payload?.data?.data,
    payload?.data?.trades,
    payload?.trades,
    payload?.items,
    payload?.data?.items,
    payload
  );
}

function extractToken(payload) {
  if (payload?.data?.token) return payload.data.token;
  if (payload?.data && !Array.isArray(payload.data)) return payload.data;
  if (payload?.token) return payload.token;
  return payload || null;
}

function timestampOf(t) {
  let x = n(t?.t, t?.timestamp, t?.time, t?.created_at, t?.createdAt, t?.date);
  if (!Number.isFinite(x)) return 0;
  if (x < 100000000000) x *= 1000;
  return x;
}

function actionOf(t) {
  const raw = String(t?.type ?? t?.side ?? t?.action ?? "").toLowerCase();
  if (raw.includes("buy")) return "buy";
  if (raw.includes("sell")) return "sell";
  return raw;
}

async function getShmUsd() {
  try {
    const j = await getJson("https://api.coinpaprika.com/v1/tickers/shm-shardeum", 2);
    return n(j?.quotes?.USD?.price);
  } catch {
    return NaN;
  }
}

function normalizeToken(source, fallback, shmUsd) {
  const s = source || fallback || {};
  const priceShm = n(s.price, s.price_shm, s.priceShm);

  let priceUsd = n(s.price_usd, s.priceUsd, s.usd_price, s.usdPrice);
  if (!Number.isFinite(priceUsd) && Number.isFinite(priceShm) && Number.isFinite(shmUsd)) {
    priceUsd = priceShm * shmUsd;
  }

  const supply = n(s.circulating_supply, s.circulatingSupply, s.current_supply, s.currentSupply, s.total_supply, s.totalSupply, s.supply);
  let marketCapUsd = n(s.market_cap_usd, s.marketCapUsd, s.market_cap_usd_value, s.marketCapUSD);

  if (!Number.isFinite(marketCapUsd)) {
    const currency = String(s.market_cap_currency || s.marketCapCurrency || "").toUpperCase();
    if (currency === "USD" || currency === "$") marketCapUsd = n(s.market_cap, s.marketCap);
  }

  if (!Number.isFinite(marketCapUsd) && Number.isFinite(priceUsd) && Number.isFinite(supply)) {
    marketCapUsd = priceUsd * supply;
  }

  return {
    token_ca: s.token_ca || s.contract || s.address || fallback?.token_ca || fallback?.contract || fallback?.address || "",
    name: s.name || fallback?.name || "Unknown",
    ticker: s.ticker || s.symbol || fallback?.ticker || fallback?.symbol || "",
    image_url: s.image_url || s.image || s.logo || fallback?.image_url || fallback?.image || fallback?.logo || "",
    marketCapUsd: Number.isFinite(marketCapUsd) ? marketCapUsd : null,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    txns: n(s.txns, s.transactions, s.total_transactions, s.totalTransactions, s.total_trades, s.totalTrades, s.trade_count, s.tradeCount),
    volumeUsd: n(s.volume_usd, s.volumeUsd, s.total_volume_usd, s.totalVolumeUsd, s.volume_24h_usd, s.volume24hUsd),
    traders: n(s.traders, s.unique_traders, s.uniqueTraders, s.trader_count, s.traderCount, s.holders_traded, s.holdersTraded)
  };
}

function normalizeTrade(t, token, shmUsd) {
  const timestamp = timestampOf(t);
  const type = actionOf(t);
  const priceShm = n(t?.price, t?.price_shm, t?.priceShm);
  let priceUsd = n(t?.price_usd, t?.priceUsd, t?.usd_price, t?.usdPrice);
  if (!Number.isFinite(priceUsd) && Number.isFinite(priceShm) && Number.isFinite(shmUsd)) priceUsd = priceShm * shmUsd;

  const volumeShm = n(t?.volume, t?.amount, t?.shm_amount, t?.shmAmount, t?.amount_shm, t?.amountShm, t?.value, t?.value_shm, t?.valueShm);
  let volumeUsd = n(t?.volume_usd, t?.volumeUsd, t?.usd_volume, t?.usdVolume, t?.trade_value_usd, t?.tradeValueUsd, t?.value_usd, t?.valueUsd);
  if (!Number.isFinite(volumeUsd) && Number.isFinite(volumeShm) && Number.isFinite(shmUsd)) volumeUsd = volumeShm * shmUsd;

  return {
    token_ca: token.token_ca,
    name: token.name,
    ticker: token.ticker,
    image_url: token.image_url,
    type,
    price: Number.isFinite(priceShm) ? priceShm : null,
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
    volumeShm: Number.isFinite(volumeShm) ? volumeShm : null,
    volumeUsd: Number.isFinite(volumeUsd) ? volumeUsd : null,
    timestamp,
    tx: t?.tx || t?.tx_hash || t?.txHash || t?.hash || ""
  };
}

async function getTokenTrades(address, mover, shmUsd) {
  let tokenInfo = mover;

  try {
    const payload = await getJson(`${SIKKA_BASE_URL}/tokens/${encodeURIComponent(address)}`, 2);
    tokenInfo = extractToken(payload) || mover;
  } catch (e) {
    console.error("Token details failed:", address, e.message);
  }

  let rawTrades = [];
  try {
    // Keep this endpoint WITHOUT a limit query parameter.
    const payload = await getJson(`${SIKKA_BASE_URL}/tokens/${encodeURIComponent(address)}/trades`, 2);
    rawTrades = extractTrades(payload);
  } catch (e) {
    console.error("Trades failed:", address, e.message);
  }

  const token = normalizeToken(tokenInfo, mover, shmUsd);
  const trades = rawTrades
    .map(t => normalizeTrade(t, token, shmUsd))
    .filter(t => t.timestamp > 0 && (t.type === "buy" || t.type === "sell"))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_TRADES_PER_TOKEN);

  const apiTradeCount = n(tokenInfo.total_trades, tokenInfo.totalTrades, tokenInfo.trade_count, tokenInfo.tradeCount, tokenInfo.trades_count, tokenInfo.tradesCount);

  return {
    token: { ...token, totalTrades: Number.isFinite(apiTradeCount) ? apiTradeCount : trades.length },
    trades
  };
}

async function workers(items, fn, concurrency) {
  const output = new Array(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= items.length) return;
      try { output[i] = await fn(items[i]); }
      catch (e) { console.error("Sikka worker error:", e); output[i] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

export default async function handler(req, res) {
  try {
    const shmUsd = await getShmUsd();

    let movers = [];
    let discoveryError = null;

    try {
      const moversPayload = await getJson(`${SIKKA_BASE_URL}/tokens/movers`, 4);
      movers = extractMovers(moversPayload)
        .filter(x => x?.token_ca || x?.address || x?.contract)
        .slice(0, MAX_TOKENS);
    } catch (e) {
      discoveryError = e.message;
      console.error("Sikka movers failed:", e.message);
    }

    // If the movers endpoint is temporarily returning 502, still try
    // the Shantum token directly so the dashboard does not go blank.
    if (!movers.length) {
      movers = [{
        token_ca: SHANTUM_CONTRACT,
        name: "Shantum",
        ticker: "STM"
      }];
    }

    const results = await workers(movers, async mover => {
      const address = mover.token_ca || mover.address || mover.contract;
      return getTokenTrades(address, mover, shmUsd);
    }, CONCURRENCY);

    const validResults = results.filter(Boolean);
    const tokens = validResults.map(x => x.token);
    const trades = validResults
      .flatMap(x => x.trades)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_LATEST_TRADES);

    const totalTradeCount = tokens.reduce((sum, token) => {
      const x = n(token.totalTrades);
      return sum + (Number.isFinite(x) ? x : 0);
    }, 0);

    return res.status(200).json({
      success: true,
      checkedAt: new Date().toISOString(),
      tokenCount: tokens.length,
      totalTradeCount,
      count: trades.length,
      limit: MAX_LATEST_TRADES,
      sort: "timestamp_desc",
      discoveryError,
      fallbackUsed: !discoveryError ? false : true,
      tokens,
      trades
    });
  } catch (error) {
    console.error("Sikka live trades error:", error);
    return res.status(200).json({
      success: false,
      error: error.message,
      tokenCount: 0,
      totalTradeCount: 0,
      count: 0,
      tokens: [],
      trades: []
    });
  }
}
