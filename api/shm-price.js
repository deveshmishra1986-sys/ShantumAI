export default async function handler(req, res) {
  try {
    const url =
      "https://pro-api.coinmarketcap.com/public-api/v3/cryptocurrency/quotes/latest" +
      "?slug=shardeum-new&convert=USD";

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

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `CoinMarketCap HTTP ${response.status}`,
        details: data
      });
    }

    /*
      CMC response is normally:

      data: {
        "12345": {
          name: "Shardeum",
          symbol: "SHM",
          quote: {
            USD: {
              price: ...
            }
          }
        }
      }
    */

    const records = data?.data || {};

    const shm = Object.values(records).find(
      item =>
        String(item?.symbol || "").toUpperCase() === "SHM"
    );

    const price =
      shm?.quote?.USD?.price ?? null;

    if (price === null) {
      return res.status(502).json({
        success: false,
        error: "SHM price not found",
        cmcResponse: data
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