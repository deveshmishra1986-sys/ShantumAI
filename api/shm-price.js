const SHM_API =
  "https://api.coinpaprika.com/v1/search?q=SHM&c=currencies&limit=10";

export default async function handler(req, res) {
  try {
    // Find SHM
    const searchResponse = await fetch(SHM_API, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!searchResponse.ok) {
      throw new Error(
        `CoinPaprika search HTTP ${searchResponse.status}`
      );
    }

    const searchData = await searchResponse.json();

    const coin = (searchData.currencies || []).find(
      (item) =>
        String(item.symbol).toUpperCase() === "SHM" &&
        String(item.name).toLowerCase().includes("shardeum")
    );

    if (!coin) {
      throw new Error("Shardeum (SHM) not found");
    }

    // Get price
    const priceResponse = await fetch(
      `https://api.coinpaprika.com/v1/tickers/${coin.id}?quotes=USD`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!priceResponse.ok) {
      throw new Error(
        `CoinPaprika price HTTP ${priceResponse.status}`
      );
    }

    const priceData = await priceResponse.json();

    const priceUsd =
      priceData?.quotes?.USD?.price;

    if (
      priceUsd === undefined ||
      priceUsd === null
    ) {
      throw new Error("SHM USD price not found");
    }

    return res.status(200).json({
      success: true,
      symbol: "SHM",
      priceUsd: Number(priceUsd),
      source: "CoinPaprika",
      checkedAt: new Date().toISOString()
    });

  } catch (error) {

    console.error("SHM PRICE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
