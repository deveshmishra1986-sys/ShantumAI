const TX =
  "0x6d372e3d993ddb281c749811f0323b4da7e79a0e75ab81905c1c97aa2cd71f92";

module.exports = async function handler(req, res) {
  try {
    const url =
      `https://explorer.shardeum.org/api/v2/transactions/${TX}/token-transfers`;

    const response = await fetch(url);

    const text = await response.text();

    res.status(200).json({
      status: response.status,
      response: text
    });

  } catch (error) {

    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
