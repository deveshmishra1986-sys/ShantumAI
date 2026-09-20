
const SHM_API =
  "https://api.coingecko.com/api/v3/simple/price?ids=shardeum-2&vs_currencies=usd";

export default async function handler(req, res) {
  try {
    const response = await fetch(SHM_API, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "ShantumDashboard/1.0"
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return res.status(200).json({
      success: true,
      httpStatus: response.status,
      coinGeckoResponse: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
