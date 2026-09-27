// ==================================================
// SIKKA LIVE TRADES
//
// SOURCE:
// 1. /tokens/lists?type=trending
// 2. /tokens/{token_ca}/trades
// ==================================================

const SIKKA_BASE_URL =
  "https://api.sikka.fun/api/v1";

const TRENDING_LIMIT = 20;
const TRADES_LIMIT = 100;


// ==================================================
// HELPERS
// ==================================================

function firstValidNumber(...values) {

  for (const value of values) {

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {

      const num = Number(value);

      if (
        Number.isFinite(num) &&
        num > 0
      ) {
        return num;
      }
    }
  }

  return null;
}


// ==================================================
// MARKET CAP
//
// Sikka market_cap is in SHM.
// Convert it to USD using SHM/USD.
// ==================================================

function getMarketCapUsd(
  token,
  shmUsd
) {

  const marketCapShm =
    firstValidNumber(
      token?.market_cap,
      token?.marketCap
    );

  if (
    marketCapShm === null
  ) {
    return null;
  }

  if (
    !Number.isFinite(shmUsd) ||
    shmUsd <= 0
  ) {
    return null;
  }

  return marketCapShm * shmUsd;
}


// ==================================================
// NORMALIZE TOKEN
// ==================================================

function normalizeToken(
  token,
  shmUsd
) {

  const tokenAddress =
    token?.token_ca ||
    token?.contract ||
    token?.address ||
    "";

  const name =
    token?.name ||
    "";

  const ticker =
    token?.ticker ||
    token?.symbol ||
    "";

  const symbol =
    token?.symbol ||
    token?.ticker ||
    "";

  const marketCapShm =
    firstValidNumber(
      token?.market_cap,
      token?.marketCap
    );

  const marketCapUsd =
    getMarketCapUsd(
      token,
      shmUsd
    );


  return {

    token_ca:
      tokenAddress,

    name,

    ticker,

    symbol,

    image_url:
      token?.image_url ||
      "",

    current_price:
      token?.current_price ??
      token?.price ??
      "",

    // Original Sikka MCAP
    // This value is in SHM.
    market_cap:
      marketCapShm !== null
        ? marketCapShm
        : "",

    // New USD MCAP
    marketCapUsd:
      marketCapUsd !== null
        ? marketCapUsd
        : null,

    volume_24h:
      token?.volume_24h ??
      token?.volume24h ??
      "",

    holders_count:
      token?.holders_count ??
      token?.holdersCount ??
      "",

    created_at:
      token?.created_at ??
      token?.createdAt ??
      ""
  };
}


// ==================================================
// MAIN HANDLER
// ==================================================

export default async function handler(
  req,
  res
) {

  try {

    // ------------------------------------------------
    // 1. GET SHM/USD PRICE
    //
    // CoinGecko first.
    // Gate fallback.
    // ------------------------------------------------

    const shmUsd =
      await getShmUsd();


    // ------------------------------------------------
    // 2. GET TRENDING TOKENS
    // ------------------------------------------------

    const trendingResponse =
      await fetch(

        `${SIKKA_BASE_URL}/tokens/lists?type=trending&limit=${TRENDING_LIMIT}`,

        {
          cache: "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }

      );


    if (
      !trendingResponse.ok
    ) {

      throw new Error(
        `Trending API HTTP ${trendingResponse.status}`
      );

    }


    const trendingResult =
      await trendingResponse.json();


    const trendingTokens =
      Array.isArray(
        trendingResult?.data?.tokens
      )
        ? trendingResult.data.tokens
        : [];


    // ------------------------------------------------
    // NO TRENDING TOKENS
    // ------------------------------------------------

    if (
      !trendingTokens.length
    ) {

      return res.status(200).json({

        success: true,

        date:
          new Date().toISOString(),

        shmUsd:
          Number.isFinite(shmUsd)
            ? shmUsd
            : null,

        totalTrendingTokens:
          0,

        totalTradeCount:
          0,

        tokens: [],

        trades: []

      });

    }


    // ------------------------------------------------
    // 3. GET RECENT TRADES
    // ------------------------------------------------

    const results =
      await Promise.all(

        trendingTokens.map(
          async (token) => {

            const tokenAddress =
              token?.token_ca ||
              token?.contract ||
              token?.address;


            if (
              !tokenAddress
            ) {

              return {

                token,

                trades: []

              };

            }


            try {

              const tradesResponse =
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
                !tradesResponse.ok
              ) {

                console.warn(

                  `Trades API failed for ${tokenAddress}: HTTP ${tradesResponse.status}`

                );


                return {

                  token,

                  trades: []

                };

              }


              const tradesResult =
                await tradesResponse.json();


              const tokenTrades =
                Array.isArray(
                  tradesResult?.data
                )
                  ? tradesResult.data
                  : [];


              // ------------------------------------------------
              // ADD TOKEN INFORMATION TO EACH TRADE
              // ------------------------------------------------

              const normalizedTrades =
                tokenTrades.map(
                  (trade) => ({

                    ...trade,

                    token_ca:
                      token?.token_ca ||
                      token?.contract ||
                      token?.address ||
                      "",

                    name:
                      token?.name ||
                      "",

                    ticker:
                      token?.ticker ||
                      token?.symbol ||
                      "",

                    symbol:
                      token?.symbol ||
                      token?.ticker ||
                      "",

                    image_url:
                      token?.image_url ||
                      "",

                    // Keep original trade price.
                    // Frontend already handles USD.
                    priceUsd:
                      null

                  })
                );


              return {

                token,

                trades:
                  normalizedTrades

              };


            }

            catch (error) {

              console.error(

                `Trade fetch error for ${tokenAddress}:`,

                error?.message

              );


              return {

                token,

                trades: []

              };

            }

          }
        )

      );


    // ------------------------------------------------
    // 4. COMBINE ALL TRADES
    // ------------------------------------------------

    const allTrades = [];


    results.forEach(
      (result) => {

        if (
          !Array.isArray(
            result?.trades
          )
        ) {

          return;

        }


        result.trades.forEach(
          (trade) => {

            allTrades.push(
              trade
            );

          }
        );

      }
    );


    // ------------------------------------------------
    // 5. SORT LATEST TRADE FIRST
    // ------------------------------------------------

    allTrades.sort(
      (a, b) => {

        const timeA =
          Number(
            a?.t || 0
          );

        const timeB =
          Number(
            b?.t || 0
          );

        return (
          timeB - timeA
        );

      }
    );


    // ------------------------------------------------
    // 6. NORMALIZE TOKENS
    // ------------------------------------------------

    const normalizedTokens =
      trendingTokens.map(
        (token) =>
          normalizeToken(
            token,
            shmUsd
          )
      );


    // ------------------------------------------------
    // 7. RETURN DATA
    // ------------------------------------------------

    return res.status(200).json({

      success: true,

      date:
        new Date().toISOString(),

      // Current SHM/USD
      shmUsd:
        Number.isFinite(shmUsd)
          ? shmUsd
          : null,

      totalTrendingTokens:
        trendingTokens.length,

      totalTradeCount:
        allTrades.length,

      tokens:
        normalizedTokens,

      trades:
        allTrades

    });


  }

  catch (error) {

    console.error(

      "SIKKA TRENDING/TRADES ERROR:",

      error

    );


    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        "Unable to load Sikka trending tokens"

    });

  }

}


// ==================================================
// SHM/USD PRICE
// ==================================================

async function getShmUsd() {

  // ------------------------------------------------
  // 1. COINGECKO
  // ------------------------------------------------

  try {

    const response =
      await fetch(

        "https://api.coingecko.com/api/v3/simple/price?ids=shardeum-2&vs_currencies=usd",

        {
          cache:
            "no-store",

          headers: {

            Accept:
              "application/json",

            "User-Agent":
              "ShantumAI/1.0"

          }

        }

      );


    if (
      response.ok
    ) {

      const data =
        await response.json();


      const price =
        Number(
          data?.["shardeum-2"]?.usd
        );


      if (
        Number.isFinite(price) &&
        price > 0
      ) {

        return price;

      }

    }

  }

  catch (error) {

    console.warn(

      "CoinGecko SHM error:",

      error?.message

    );

  }


  // ------------------------------------------------
  // 2. GATE FALLBACK
  // ------------------------------------------------

  try {

    const response =
      await fetch(

        "https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SHM_USDT",

        {
          cache:
            "no-store",

          headers: {

            Accept:
              "application/json",

            "User-Agent":
              "ShantumAI/1.0"

          }

        }

      );


    if (
      response.ok
    ) {

      const data =
        await response.json();


      const price =
        Number(
          data?.[0]?.last
        );


      if (
        Number.isFinite(price) &&
        price > 0
      ) {

        return price;

      }

    }

  }

  catch (error) {

    console.warn(

      "Gate SHM error:",

      error?.message

    );

  }


  return NaN;

}
