const SIKKA_BASE_URL =
  "https://api.sikka.fun/api/v1";

export default async function handler(req, res) {
  try {
    const moversResponse = await fetch(
      `${SIKKA_BASE_URL}/tokens/movers`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" }
      }
    );

    if (!moversResponse.ok) {
      throw new Error(`Movers API HTTP ${moversResponse.status}`);
    }

    const moversResult = await moversResponse.json();
    const tokens = moversResult?.data?.movers || [];

    if (!tokens.length) {
      return res.status(200).json({
        success: true,
        trades: []
      });
    }

    const activeTokens = tokens
      .filter(token => token.token_ca && token.name)
      .slice(0, 50);

    const tradeResults = await Promise.all(
      activeTokens.map(async token => {
        try {
          const tradeResponse = await fetch(
            `${SIKKA_BASE_URL}/tokens/${token.token_ca}/trades`,
            {
              cache: "no-store",
              headers: { Accept: "application/json" }
            }
          );

          if (!tradeResponse.ok) return [];

          const tradeResult = await tradeResponse.json();

          const trades =
            Array.isArray(tradeResult?.data)
              ? tradeResult.data
              : Array.isArray(tradeResult?.data?.data)
                ? tradeResult.data.data
                : [];

          return trades.map(trade => ({
            name: token.name,
            ticker: token.ticker,
            token_ca: token.token_ca,
            image_url: token.image_url,
            price: trade.price,
            type: String(trade.type || "").trim().toLowerCase(),
            timestamp: Number(trade.t || trade.timestamp || 0),
            tx: trade.tx
          }));
        } catch (error) {
          console.error(`Trade error for ${token.name}:`, error);
          return [];
        }
      })
    );

    const allTrades = tradeResults.flat();

    const validTrades = allTrades
      .filter(trade =>
        trade.timestamp > 0 &&
        (trade.type === "buy" || trade.type === "sell")
      )
      .sort(
        (a, b) =>
          Number(b.timestamp || 0) -
          Number(a.timestamp || 0)
      );

    // Keep the newest 15 trades, but make sure a SELL is not
    // accidentally hidden when Sikka has a SELL in the returned data.
    let latestTrades = validTrades.slice(0, 15);

    const hasSell = latestTrades.some(
      trade => trade.type === "sell"
    );

    if (!hasSell) {
      const latestSell = validTrades.find(
        trade => trade.type === "sell"
      );

      if (latestSell) {
        latestTrades = [
          ...latestTrades.slice(0, 14),
          latestSell
        ].sort(
          (a, b) =>
            Number(b.timestamp || 0) -
            Number(a.timestamp || 0)
        );
      }
    }

    return res.status(200).json({
      success: true,
      count: latestTrades.length,
      trades: latestTrades,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Sikka live trades error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
