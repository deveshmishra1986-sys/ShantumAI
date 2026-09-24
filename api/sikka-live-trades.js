const SIKKA_BASE_URL =
  "https://api.sikka.fun/api/v1";

export default async function handler(req, res) {
  try {
    // --------------------------------------------------
    // 1. GET ACTIVE / MOVING TOKENS
    // --------------------------------------------------

    const moversResponse = await fetch(
      `${SIKKA_BASE_URL}/tokens/movers`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!moversResponse.ok) {
      throw new Error(
        `Movers API HTTP ${moversResponse.status}`
      );
    }

    const moversResult =
      await moversResponse.json();

    const tokens =
      moversResult?.data?.movers || [];

    if (!tokens.length) {
      return res.status(200).json({
        success: true,
        trades: []
      });
    }

    // --------------------------------------------------
    // 2. TAKE MORE ACTIVE TOKENS
    // --------------------------------------------------

    const activeTokens =
      tokens
        .filter(token =>
          token.token_ca &&
          token.name
        )
        .slice(0, 50);

    // --------------------------------------------------
    // 3. GET TRADES FOR EACH TOKEN
    // --------------------------------------------------

    const tradeResults =
      await Promise.all(
        activeTokens.map(async token => {

          try {

            const tradeResponse =
              await fetch(
                `${SIKKA_BASE_URL}/tokens/${token.token_ca}/trades`,
                {
                  cache: "no-store",
                  headers: {
                    Accept: "application/json"
                  }
                }
              );

            if (!tradeResponse.ok) {
              return [];
            }

            const tradeResult =
              await tradeResponse.json();

            const trades =
              Array.isArray(tradeResult?.data)
                ? tradeResult.data
                : Array.isArray(tradeResult?.data?.data)
                  ? tradeResult.data.data
                  : [];

            if (!Array.isArray(trades)) {
              return [];
            }

            // Keep enough records so we can find
            // the latest BUY and latest SELL.
            return trades
              .slice(0, 20)
              .map(trade => ({
                name: token.name,
                ticker: token.ticker,
                token_ca: token.token_ca,
                image_url: token.image_url,
                price: trade.price,
                type: String(trade.type || "").toLowerCase(),
                timestamp: Number(trade.t || 0),
                tx: trade.tx
              }));

          } catch (error) {

            console.error(
              `Trade error for ${token.name}:`,
              error
            );

            return [];
          }

        })
      );

    // --------------------------------------------------
    // 4. COMBINE ALL TRADES
    // --------------------------------------------------

    const allTrades =
      tradeResults.flat();

    // --------------------------------------------------
    // 5. KEEP ONLY VALID BUY / SELL TRADES
    // --------------------------------------------------

    const validTrades =
      allTrades.filter(trade =>
        trade.timestamp > 0 &&
        (
          trade.type === "buy" ||
          trade.type === "sell"
        )
      );

    // --------------------------------------------------
    // 6. GET LATEST BUY + LATEST SELL FOR EACH TOKEN
    // --------------------------------------------------

    const tokenGroups = {};

    for (const trade of validTrades) {

      if (!tokenGroups[trade.token_ca]) {
        tokenGroups[trade.token_ca] = {
          buy: null,
          sell: null
        };
      }

      const group =
        tokenGroups[trade.token_ca];

      if (
        trade.type === "buy" &&
        (
          !group.buy ||
          trade.timestamp > group.buy.timestamp
        )
      ) {
        group.buy = trade;
      }

      if (
        trade.type === "sell" &&
        (
          !group.sell ||
          trade.timestamp > group.sell.timestamp
        )
      ) {
        group.sell = trade;
      }
    }

    // --------------------------------------------------
    // 7. COMBINE LATEST BUY + SELL
    // --------------------------------------------------

    const selectedTrades = [];

    for (const tokenCa in tokenGroups) {

      const group =
        tokenGroups[tokenCa];

      if (group.buy) {
        selectedTrades.push(group.buy);
      }

      if (group.sell) {
        selectedTrades.push(group.sell);
      }
    }

    // --------------------------------------------------
    // 8. SORT NEWEST FIRST
    // --------------------------------------------------

    selectedTrades.sort(
      (a, b) =>
        Number(b.timestamp || 0) -
        Number(a.timestamp || 0)
    );

    // --------------------------------------------------
    // 9. RETURN LATEST 15 BUY / SELL TRADES
    // --------------------------------------------------

    const latestTrades =
      selectedTrades.slice(0, 15);

    return res.status(200).json({
      success: true,
      count: latestTrades.length,
      trades: latestTrades,
      checkedAt: new Date().toISOString()
    });

  } catch (error) {

    console.error(
      "Sikka live trades error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
