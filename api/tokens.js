const URL =
  "https://explorer.shardeum.org/api/v2/transactions/" +
  "0x6d372e3d993ddb281c749811f0323b4da7e79a0e75ab81905c1c97aa2cd71f92/" +
  "token-transfers";

module.exports = async function handler(req, res) {

  try {

    const response = await fetch(URL);

    const text = await response.text();

    return res.status(200).json({
      httpStatus: response.status,
      data: JSON.parse(text)
    });

  } catch (error) {

    return res.status(500).json({
      error: error.message
    });
  }
};
