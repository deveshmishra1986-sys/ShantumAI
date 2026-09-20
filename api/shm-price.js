const SHM_API =
  "https://api.coinpaprika.com/v1/tickers/shm-shardeum?quotes=USD";

export default async function handler(req, res) {
  try {
    const response = await fetch(SHM_API, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `CoinPaprika HTTP ${response.status}`
      );
    }

    const data = await response.json();

    const priceUsd = data?.quotes?.USD?.price;

    if (priceUsd === undefined || priceUsd === null) {
      throw new Error("SHM price not found");
    }

    return res.status(200).json({
      success: true,
      name: "Shardeum",
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
