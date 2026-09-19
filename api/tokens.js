const EXPLORER_API =
  "https://explorer.shardeum.org/api/v2";

const TX =
  "0x6d372e3d993ddb281c749811f0323b4da7e79a0e75ab81905c1c97aa2cd71f92";

export default async function handler(req, res) {
  try {
    const url =
      `${EXPLORER_API}/transactions/${TX}/token-transfers`;

    const response = await fetch(url);

    const data = await response.json();

    return res.status(200).json({
      success: true,
      status: response.status,
      data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
