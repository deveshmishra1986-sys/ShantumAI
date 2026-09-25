// ==================================================
// SIKKA CANDLES API - SHANTUM
// ==================================================

const SIKKA_BASE_URL = "https://api.sikka.fun/api/v1";
const SHANTUM_CONTRACT = "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

export default async function handler(req, res) {
  const allowed = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "12h", "24h"]);
  const timeframe = allowed.has(String(req.query?.timeframe || "24h"))
    ? String(req.query.timeframe)
    : "24h";

  const requestedLimit = Number(req.query?.limit || 200);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
    : 200;

  try {
    const url = `${SIKKA_BASE_URL}/tokens/${SHANTUM_CONTRACT}/candles?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`;

    let response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    let payload = null;
    if (response.ok) {
      payload = await response.json();
    }

    // Some public deployments have returned the candles endpoint without
    // accepting query parameters. Retry the plain endpoint if necessary.
    if (!response.ok || !extractCandles(payload).length) {
      response = await fetch(
        `${SIKKA_BASE_URL}/tokens/${SHANTUM_CONTRACT}/candles`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" }
        }
      );

      if (!response.ok) {
        throw new Error(`Sikka candles HTTP ${response.status}`);
      }

      payload = await response.json();
    }

    let candles = extractCandles(payload)
      .map(normalizeCandle)
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);

    // Keep the requested number of latest candles.
    if (candles.length > limit) {
      candles = candles.slice(-limit);
    }

    if (!candles.length) {
      throw new Error("Sikka returned no candle records");
    }

    return res.status(200).json({
      success: true,
      token: SHANTUM_CONTRACT,
      timeframe,
      count: candles.length,
      candles,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Sikka candles error:", error);

    return res.status(502).json({
      success: false,
      error: error.message,
      candles: []
    });
  }
}

function extractCandles(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.data?.candles,
    payload?.candles,
    payload?.items,
    payload?.data?.items
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeCandle(c) {
  if (!c) return null;

  const tRaw = c.t ?? c.time ?? c.timestamp ?? c.ts;
  const oRaw = c.o ?? c.open;
  const hRaw = c.h ?? c.high;
  const lRaw = c.l ?? c.low;
  const closeRaw = c.c ?? c.close;
  const vRaw = c.v ?? c.volume;

  let t = Number(tRaw);
  if (!Number.isFinite(t) || t <= 0) return null;
  if (t > 100000000000) t = Math.floor(t / 1000);

  const o = Number(oRaw);
  const h = Number(hRaw);
  const l = Number(lRaw);
  const close = Number(closeRaw);
  const v = Number(vRaw);

  if (![o, h, l, close].every(Number.isFinite)) return null;

  return {
    t,
    o,
    h,
    l,
    c: close,
    v: Number.isFinite(v) ? v : 0,
    vt: Number.isFinite(Number(c.vt)) ? Number(c.vt) : 0,
    n: Number.isFinite(Number(c.n)) ? Number(c.n) : 0
  };
}
