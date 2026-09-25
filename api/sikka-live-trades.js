// ==================================================
// SIKKA LIVE TRADES API
// ==================================================

const SIKKA_BASE_URL =
  "https://api.sikka.fun/api/v1";

const MAX_TOKENS =
  50;

const TRADES_LIMIT =
  1000;


// --------------------------------------------------
// MAIN HANDLER
// --------------------------------------------------

export default async function handler(
  req,
  res
) {

  try {

    const shmUsd =
      await getShmUsd();

    const moversResponse =
      await fetch(
        `${SIKKA_BASE_URL}/tokens/movers`,
        {
          cache: "no-store",
          headers: {
            Accept:
              "application/json"
          }
        }
      );


    if (
      !moversResponse.ok
    ) {

      throw new Error(
        `Movers API HTTP ${moversResponse.status}`
      );

    }


    const moversResult =
      await moversResponse.json();


    const movers =
      Array.isArray(
        moversResult?.data?.movers
      )
        ? moversResult.data.movers
        : [];


    const activeTokens =
      movers
        .filter(
          token =>
            token &&
            (
              token.token_ca ||
              token.contract ||
              token.address
            )
        )
        .slice(
          0,
          MAX_TOKENS
        );


    if (
      !activeTokens.length
    ) {

      return res.status(
        200
      ).json({

        success:
          true,

        date:
          new Date().toISOString(),

        totalTradeCount:
          0,

        tokens:
          [],

        trades:
          []

      });

    }


    // --------------------------------------------------
    // LOAD TOKEN DETAILS + TRADES
    // --------------------------------------------------

    const results =
      await Promise.all(

        activeTokens.map(
          async token => {

            const tokenAddress =
              token.token_ca ||
              token.contract ||
              token.address;


            let tokenInfo =
              token;

            let trades =
              [];


            // ------------------------------------------
            // TOKEN DETAILS
            // ------------------------------------------

            try {

              const tokenResponse =
                await fetch(
                  `${SIKKA_BASE_URL}/tokens/${tokenAddress}`,
                  {
                    cache:
                      "no-store",
                    headers: {
                      Accept:
                        "application/json"
                    }
                  }
                );


              if (
                tokenResponse.ok
              ) {

                const tokenResult =
                  await tokenResponse.json();


                tokenInfo =
                  extractToken(
                    tokenResult
                  ) ||
                  token;

              }

            }

            catch (error) {

              console.error(
                `Token info error for ${tokenAddress}:`,
                error
              );

            }


            // ------------------------------------------
            // TRADES
            // ------------------------------------------

            try {

              const tradeResponse =
                await fetch(
                  `${SIKKA_BASE_URL}/tokens/${tokenAddress}/trades?limit=${TRADES_LIMIT}`,
                  {
                    cache:
                      "no-store",
                    headers: {
                      Accept:
                        "application/json"
                    }
                  }
                );


              if (
                tradeResponse.ok
              ) {

                const tradeResult =
                  await tradeResponse.json();


                trades =
                  extractTrades(
                    tradeResult
                  );

              }

            }

            catch (error) {

              console.error(
                `Trade error for ${tokenAddress}:`,
                error
              );

            }


            const normalizedToken =
              normalizeToken(
                tokenInfo,
                token,
                shmUsd
              );


            const normalizedTrades =
              trades
                .map(
                  trade =>
                    normalizeTrade(
                      trade,
                      normalizedToken
                    )
                )
                .filter(
                  trade =>
                    trade.timestamp > 0
                );


            /*
             * Prefer a token-level all-time
             * trade count when Sikka supplies it.
             * Otherwise use the number of trades
             * returned by the public endpoint.
             */

            const tokenTradeCount =
              firstFiniteNumber(
                tokenInfo.total_trades,
                tokenInfo.totalTrades,
                tokenInfo.trade_count,
                tokenInfo.tradeCount,
                tokenInfo.trades_count,
                tokenInfo.tradesCount
              );


            return {

              token:
                normalizedToken,

              trades:
                normalizedTrades,

              totalTrades:
                Number.isFinite(
                  tokenTradeCount
                )
                  ? tokenTradeCount
                  : normalizedTrades.length

            };

          }
        )

      );


    // --------------------------------------------------
    // FLATTEN
    // --------------------------------------------------

    const tokens =
      results
        .map(
          result => ({
            ...result.token,

            totalTrades:
              result.totalTrades,

            volumeUsd:
              calculateTokenVolume(
                result
              )
          })
        );


    const allTrades =
      results
        .flatMap(
          result =>
            result.trades
        )
        .sort(
          (a, b) =>
            Number(
              b.timestamp
            ) -
            Number(
              a.timestamp
            )
        );


    /*
     * Sum token-level counts where available.
     * This is more useful than simply counting
     * the visible rows.
     */

    const totalTradeCount =
      results.reduce(
        (
          total,
          result
        ) =>
          total +
          (
            Number.isFinite(
              Number(
                result.totalTrades
              )
            )
              ? Number(
                  result.totalTrades
                )
              : result.trades.length
          ),
        0
      );


    return res.status(
      200
    ).json({

      success:
        true,

      checkedAt:
        new Date().toISOString(),

      tokenCount:
        tokens.length,

      totalTradeCount:
        totalTradeCount,

      /*
       * If the public endpoint returns
       * paginated/limited history, this is
       * the history available from that endpoint.
       */

      historyNote:
        "Trades returned by the public Sikka token trade endpoints.",

      tokens:
        tokens,

      trades:
        allTrades

    });

  }

  catch (error) {

    console.error(
      "Sikka live trades error:",
      error
    );


    return res.status(
      500
    ).json({

      success:
        false,

      error:
        error.message

    });

  }

}


// ==================================================
// HELPERS
// ==================================================

function extractToken(
  result
) {

  if (
    result?.data?.token
  ) {

    return result.data.token;

  }

  if (
    result?.data &&
    !Array.isArray(
      result.data
    )
  ) {

    return result.data;

  }

  if (
    result?.token
  ) {

    return result.token;

  }

  return null;

}


function extractTrades(
  result
) {

  if (
    Array.isArray(
      result?.data
    )
  ) {

    return result.data;

  }

  if (
    Array.isArray(
      result?.data?.data
    )
  ) {

    return result.data.data;

  }

  if (
    Array.isArray(
      result?.trades
    )
  ) {

    return result.trades;

  }

  if (
    Array.isArray(
      result?.data?.trades
    )
  ) {

    return result.data.trades;

  }

  return [];

}


function normalizeToken(
  token,
  fallback,
  shmUsd
) {

  const source =
    token || fallback || {};


  let marketCapUsd =
    firstFiniteNumber(
      source.market_cap_usd,
      source.marketCapUsd,
      source.market_cap_usd_value,
      source.marketCapUSD
    );

  /*
   * Some token APIs expose market cap without
   * a currency suffix. Use it only when the
   * API explicitly says USD, or when a USD
   * price + supply lets us calculate it.
   */

  const marketCapCurrency =
    String(
      source.market_cap_currency ||
      source.marketCapCurrency ||
      source.market_cap_currency_code ||
      ""
    ).toUpperCase();

  if (
    !Number.isFinite(marketCapUsd) &&
    (
      marketCapCurrency === "USD" ||
      marketCapCurrency === "$"
    )
  ) {
    marketCapUsd =
      firstFiniteNumber(
        source.market_cap,
        source.marketCap
      );
  }

  if (
    !Number.isFinite(marketCapUsd)
  ) {

    const priceShm =
      firstFiniteNumber(
        source.price,
        source.price_shm,
        source.priceShm
      );

    const priceUsd =
      firstFiniteNumber(
        source.price_usd,
        source.priceUsd,
        source.usd_price,
        source.usdPrice
      );

    const supply =
      firstFiniteNumber(
        source.circulating_supply,
        source.circulatingSupply,
        source.current_supply,
        source.currentSupply,
        source.total_supply,
        source.totalSupply,
        source.supply
      );

    let tokenPriceUsd =
      priceUsd;

    if (
      !Number.isFinite(tokenPriceUsd) &&
      Number.isFinite(priceShm) &&
      Number.isFinite(shmUsd)
    ) {
      tokenPriceUsd =
        priceShm * shmUsd;
    }

    if (
      Number.isFinite(tokenPriceUsd) &&
      Number.isFinite(supply)
    ) {
      marketCapUsd =
        tokenPriceUsd * supply;
    }
  }


  const tokenPriceShm =
    firstFiniteNumber(
      source.price,
      source.price_shm,
      source.priceShm
    );

  let tokenPriceUsd =
    firstFiniteNumber(
      source.price_usd,
      source.priceUsd,
      source.usd_price,
      source.usdPrice
    );

  if (
    !Number.isFinite(tokenPriceUsd) &&
    Number.isFinite(tokenPriceShm) &&
    Number.isFinite(shmUsd)
  ) {
    tokenPriceUsd =
      tokenPriceShm * shmUsd;
  }

  const txns =
    firstFiniteNumber(
      source.txns,
      source.transactions,
      source.total_transactions,
      source.totalTransactions,
      source.total_trades,
      source.totalTrades,
      source.trade_count,
      source.tradeCount
    );

  const traders =
    firstFiniteNumber(
      source.traders,
      source.unique_traders,
      source.uniqueTraders,
      source.trader_count,
      source.traderCount,
      source.holders_traded,
      source.holdersTraded
    );

  const volumeUsd =
    firstFiniteNumber(
      source.volume_usd,
      source.volumeUsd,
      source.total_volume_usd,
      source.totalVolumeUsd,
      source.volume_24h_usd,
      source.volume24hUsd
    );

  return {

    token_ca:
      source.token_ca ||
      source.contract ||
      source.address ||
      fallback.token_ca ||
      fallback.contract ||
      fallback.address ||
      "",

    name:
      source.name ||
      fallback.name ||
      "Unknown",

    ticker:
      source.ticker ||
      source.symbol ||
      fallback.ticker ||
      fallback.symbol ||
      "",

    image_url:
      source.image_url ||
      source.image ||
      source.logo ||
      fallback.image_url ||
      fallback.image ||
      "",

    marketCapUsd:
      Number.isFinite(marketCapUsd)
        ? marketCapUsd
        : null,

    priceUsd:
      Number.isFinite(tokenPriceUsd)
        ? tokenPriceUsd
        : null,

    txns:
      Number.isFinite(txns)
        ? txns
        : null,

    traders:
      Number.isFinite(traders)
        ? traders
        : null,

    volumeUsd:
      Number.isFinite(volumeUsd)
        ? volumeUsd
        : null

  };

}


function normalizeTrade(
  trade,
  token,
  shmUsd
) {

  const timestamp =
    getTimestamp(
      trade
    );


  const price =
    firstFiniteNumber(
      trade.price,
      trade.price_shm,
      trade.priceShm
    );


  let priceUsd =
    firstFiniteNumber(
      trade.price_usd,
      trade.priceUsd,
      trade.usd_price,
      trade.usdPrice
    );

  if (
    !Number.isFinite(priceUsd) &&
    Number.isFinite(price) &&
    Number.isFinite(shmUsd)
  ) {
    priceUsd =
      price * shmUsd;
  }


  let volumeUsd =
    firstFiniteNumber(
      trade.volume_usd,
      trade.volumeUsd,
      trade.usd_volume,
      trade.usdVolume,
      trade.trade_value_usd,
      trade.tradeValueUsd,
      trade.value_usd,
      trade.valueUsd
    );


  const volumeShm =
    firstFiniteNumber(
      trade.volume,
      trade.amount,
      trade.shm_amount,
      trade.shmAmount,
      trade.amount_shm,
      trade.amountShm
    );

  if (
    !Number.isFinite(volumeUsd) &&
    Number.isFinite(volumeShm) &&
    Number.isFinite(shmUsd)
  ) {
    volumeUsd =
      volumeShm * shmUsd;
  }


  return {

    token_ca:
      token.token_ca,

    name:
      token.name,

    ticker:
      token.ticker,

    image_url:
      token.image_url,

    type:
      String(
        trade.type ||
        trade.side ||
        ""
      ).toLowerCase(),

    price:
      Number.isFinite(
        price
      )
        ? price
        : null,

    priceUsd:
      Number.isFinite(
        priceUsd
      )
        ? priceUsd
        : null,

    volumeUsd:
      Number.isFinite(
        volumeUsd
      )
        ? volumeUsd
        : null,

    volumeShm:
      Number.isFinite(
        volumeShm
      )
        ? volumeShm
        : null,

    timestamp:
      timestamp,

    tx:
      trade.tx ||
      trade.hash ||
      trade.tx_hash ||
      ""

  };

}


function calculateTokenVolume(
  result
) {

  /*
   * Prefer an API-provided all-time
   * volume when available.
   */

  const apiVolume =
    firstFiniteNumber(
      result.token.volume_usd,
      result.token.volumeUsd,
      result.token.total_volume_usd,
      result.token.totalVolumeUsd,
      result.token.volume_24h_usd,
      result.token.volume24hUsd
    );


  if (
    Number.isFinite(
      apiVolume
    )
  ) {

    return apiVolume;

  }


  /*
   * Otherwise sum the USD value of
   * the trades returned by Sikka.
   */

  return result.trades.reduce(
    (
      total,
      trade
    ) => {

      if (
        Number.isFinite(
          trade.volumeUsd
        )
      ) {

        return (
          total +
          trade.volumeUsd
        );

      }

      return total;

    },
    0
  );

}



async function getShmUsd() {

  try {

    const response =
      await fetch(
        "https://api.coinpaprika.com/v1/tickers/shm-shardeum",
        {
          cache: "no-store",
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `SHM price HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    const price =
      Number(
        data?.quotes?.USD?.price
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new Error(
        "Invalid SHM/USD price"
      );
    }

    return price;

  } catch (error) {

    console.error(
      "SHM USD lookup failed:",
      error
    );

    return NaN;

  }

}

function firstFiniteNumber(
  ...values
) {

  for (
    const value of values
  ) {

    const number =
      Number(value);

    if (
      Number.isFinite(
        number
      )
    ) {

      return number;

    }

  }

  return NaN;

}


function getTimestamp(
  trade
) {

  let timestamp =
    Number(
      trade.timestamp ||
      trade.t ||
      trade.created_at ||
      trade.createdAt ||
      0
    );


  if (
    timestamp > 0 &&
    timestamp < 100000000000
  ) {

    timestamp *= 1000;

  }


  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : 0;

}
