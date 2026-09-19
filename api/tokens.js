export default async function handler(req, res) {
  try {
    const page = req.query.page || "1";

    const url =
      `https://explorer.shardeum.org/api/v2/tokens?page=${page}`;

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
      error: "Failed to load Shardeum tokens",
      details: error.message
    });
  }
}
