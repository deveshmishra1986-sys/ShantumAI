export default async function handler(req, res) {
  try {
    const params = new URLSearchParams();

    // Pass Blockscout pagination parameters from frontend
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, value);
      }
    }

    const url =
      `https://explorer.shardeum.org/api/v2/tokens?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();

      return res.status(response.status).json({
        error: "Explorer API error",
        details: text
      });
    }

    const data = await response.json();

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: "Failed to load tokens",
      details: error.message
    });
  }
}
