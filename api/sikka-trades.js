const SIKKA_BASE_URL =
  "https://api.sikka.fun/api/v1";

export default async function handler(req, res) {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token contract is required"
      });
    }

    const url =
      `${SIKKA_BASE_URL}/tokens/${token}/trades`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Sikka API HTTP ${response.status}`
      );
    }

    const data = await response.json();

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error("Sikka trades error:", error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
