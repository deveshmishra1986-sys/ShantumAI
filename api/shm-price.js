export default async function handler(req, res) {
  try {
    const url =
      "https://pro-api.coinmarketcap.com/public-api/v2/simple/price" +
      "?symbol=SHM&convert=USD";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const data = await response.json();

    console.log(
      "CoinMarketCap response:",
      JSON.stringify(data)
    );

    // Show CMC's real error instead of only "HTTP 400"
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `CoinMarketCap HTTP ${response.status}`,
        cmcError:
          data?.status?.error_message ||
          data?.status?.error_code ||
          "Unknown CoinMarketCap error",
        details: data
      });
    }

    /*
      CMC v2 Simple Price response can be
      keyed by the requested symbol.
    */

    const result =
      data?.data?.SHM ||
      data?.data?.shm ||
      null;

    let price = null;

    if (result) {
      price =
        result.price ??
        result.quote?.USD?.price ??
        result.USD?.price ??
        result.USD ??
        null;
    }

    /*
      Extra fallback:
      Search any returned object for SHM.
    */

    if (price === null && data?.data) {

      for (const item of Object.values(data.data)) {

        if (
          String(item?.symbol || "")
            .toUpperCase() === "SHM"
        ) {
          price =
            item?.price ??
            item?.quote?.USD?.price ??
            item?.USD?.price ??
            item?.USD ??
            null;

          if (price !== null) {
            break;
          }
        }
      }
    }

    if (price === null) {

      return res.status(502).json({
        success: false,
        error: "SHM price not found in CoinMarketCap response",
        details: data
      });

    }

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );

    return res.status(200).json({

      success: true,

      symbol: "SHM",

      priceUsd: Number(price),

      source: "CoinMarketCap",

      checkedAt: new Date().toISOString()

    });

  } catch (error) {

    console.error(
      "SHM price error:",
      error
    );

    return res.status(500).json({

      success: false,

      error: error.message

    });

  }
}