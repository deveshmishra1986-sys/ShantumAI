const SHM_API =
  "https://api.coingecko.com/api/v3/simple/price?ids=shardeum-2&vs_currencies=usd";

export default async function handler(req, res) {
  try {
    const response = await fetch(SHM_API, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`CoinGecko HTTP ${response.status}`);
    }

    const data = await response.json();

    const priceUsd = data?.["shardeum-new"]?.usd;

    if (priceUsd === undefined || priceUsd === null) {
      throw new Error("SHM price not found");
    }

    return res.status(200).json({
      success: true,
      symbol: "SHM",
      priceUsd: Number(priceUsd),
      checkedAt: new Date().toISOString(),
      source: "CoinGecko"
    });

  } catch (error) {

    console.error("SHM PRICE ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
