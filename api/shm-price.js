const CMC_URL =
  "https://pro-api.coinmarketcap.com/public-api/v1/simple/price?symbol=SHM&convert=USD";

export default async function handler(req, res) {
  try {
    const response = await fetch(CMC_URL, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`CoinMarketCap HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log("CMC response:", JSON.stringify(data));

    const price =
      data?.data?.SHM?.quote?.USD?.price ??
      data?.data?.SHM?.USD ??
      data?.data?.SHM?.price ??
      null;

    if (price === null) {
      return res.status(502).json({
        success: false,
        error: "SHM price not found in CoinMarketCap response",
        raw: data
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

    console.error("SHM price error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}