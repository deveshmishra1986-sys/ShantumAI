export default async function handler(req, res) {
  try {
    // Step 1:
    // Ask CMC for the current Shardeum listing by slug.
    const mapUrl =
      "https://pro-api.coinmarketcap.com/public-api/v1/cryptocurrency/map" +
      "?slug=shardeum-new";

    const mapResponse = await fetch(mapUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const mapData = await mapResponse.json();

    console.log(
      "CMC MAP:",
      JSON.stringify(mapData)
    );

    if (!mapResponse.ok) {
      return res.status(mapResponse.status).json({
        success: false,
        step: "map",
        error: `CoinMarketCap HTTP ${mapResponse.status}`,
        details: mapData
      });
    }

    const coin =
      mapData?.data?.find(
        item =>
          String(item?.symbol || "").toUpperCase() === "SHM"
      );

    if (!coin) {
      return res.status(404).json({
        success: false,
        step: "find-shm",
        error: "Shardeum (New) was not found",
        details: mapData
      });
    }

    const id = coin.id;

    // Step 2:
    // Get current price using the actual CMC ID.
    const priceUrl =
      "https://pro-api.coinmarketcap.com/public-api/v1/simple/price" +
      `?ids=${id}&convert=USD`;

    const priceResponse = await fetch(priceUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const priceData =
      await priceResponse.json();

    console.log(
      "CMC PRICE:",
      JSON.stringify(priceData)
    );

    if (!priceResponse.ok) {
      return res.status(priceResponse.status).json({
        success: false,
        step: "price",
        error: `CoinMarketCap HTTP ${priceResponse.status}`,
        coinId: id,
        coin: coin,
        details: priceData
      });
    }

    const result =
      priceData?.data?.[String(id)];

    const price =
      result?.quote?.USD?.price ??
      result?.quotes?.find(
        q => q.symbol === "USD"
      )?.price ??
      null;

    if (price === null) {
      return res.status(502).json({
        success: false,
        step: "extract-price",
        error: "Price not found",
        coinId: id,
        coin: coin,
        details: priceData
      });
    }

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );

    return res.status(200).json({
      success: true,
      symbol: "SHM",
      name: coin.name,
      coinId: id,
      priceUsd: Number(price),
      source: "CoinMarketCap",
      checkedAt: new Date().toISOString()
    });

  } catch (error) {

    console.error(
      "SHM PRICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}