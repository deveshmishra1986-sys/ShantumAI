export default async function handler(req, res) {
  try {
    const url =
      "https://pro-api.coinmarketcap.com/public-api/v2/simple/price" +
      "?slug=shardeum-new&convert=USD";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const data = await response.json();

    console.log("CMC:", JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `CoinMarketCap HTTP ${response.status}`,
        details: data
      });
    }

    /*
      Find SHM in the response.
    */

    const records = data?.data || {};

    const shm = Object.values(records).find(
      item =>
        String(item?.symbol || "").toUpperCase() === "SHM"
    );

    const price =
      shm?.quote?.USD?.price ??
      shm?.USD ??
      shm?.price ??
      null;

    if (price === null) {
      return res.status(502).json({
        success: false,
        error: "SHM price not found",
        details: data
      });
    }

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );

    return res.status(200).json({
      success: true,
      symbol: "SHM",
      priceUsd: Number(price),
      source: "CoinMarketCap",
      checkedAt: new Date().toISOString()
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}