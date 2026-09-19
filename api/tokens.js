export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "Tokens API is working",
    items: [
      {
        address: "0x3Fe5fbBA8034762fDd8d3d3b3d7E788B9a12F04",
        name: "Shantum",
        symbol: "STM",
        decimals: 18,
        tradeCount: 1
      }
    ]
  });
}
