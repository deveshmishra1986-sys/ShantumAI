const SHANTUM_CONTRACT =
  "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

export default async function handler(req, res) {
  return res.status(200).json({
    success: true,

    name: "Shantum",
    symbol: "STM",

    // Current price in SHM
    price: "0.023",
    priceCurrency: "SHM",

    // Shantum logo
    image: "/shantum-logo.png",

    contract: SHANTUM_CONTRACT,

    explorer:
      "https://explorer.shardeum.org/address/" + SHANTUM_CONTRACT
  });
}
