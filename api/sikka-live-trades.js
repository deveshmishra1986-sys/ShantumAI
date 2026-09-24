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
    // 2. TAKE ACTIVE TOKENS
    // --------------------------------------------------

    const activeTokens =
      tokens
        .filter(token =>
          token.token_ca &&
          token.name
        )
        .slice(0, 20);

    // --------------------------------------------------
    // 3. GET LATEST TRADES FOR EACH TOKEN
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
              tradeResult?.data || [];

            if (!Array.isArray(trades)) {
              return [];
            }

            // Add token information
            return trades
              .slice(0, 10)
              .map(trade => ({
                name: token.name,
                ticker: token.ticker,
                token_ca: token.token_ca,
                image_url: token.image_url,
                price: trade.price,
                type: trade.type,
                timestamp: trade.t,
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
    // 5. SORT LATEST FIRST
    // --------------------------------------------------

    allTrades.sort(
      (a, b) =>
        Number(b.timestamp || 0) -
        Number(a.timestamp || 0)
    );

    // --------------------------------------------------
    // 6. RETURN LATEST 15 TRADES
    // --------------------------------------------------

    const latestTrades =
      allTrades.slice(0, 15);

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
