const SHANTUM_CONTRACT =
  "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

const SIKKA_BASE_URL =
  "https://api.sikka.fun/api/v1";

export default async function handler(req, res) {
  try {
    const timeframe =
      req.query.timeframe || "5m";

    const allowedTimeframes = [
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "4h",
      "12h",
      "24h"
    ];

    if (!allowedTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: "Invalid timeframe"
      });
    }

    let limit =
      Number(req.query.limit) || 100;

    limit = Math.min(
      Math.max(limit, 1),
      200
    );

    const url =
      `${SIKKA_BASE_URL}/tokens/` +
      `${SHANTUM_CONTRACT}/candles` +
      `?timeframe=${timeframe}` +
      `&limit=${limit}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Sikka API HTTP ${response.status}`
      );
    }

    const candles = await response.json();

    return res.status(200).json({
      success: true,
      timeframe,
      count: Array.isArray(candles)
        ? candles.length
        : 0,
      candles
    });

  } catch (error) {
    console.error(
      "Sikka candles error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
