const RPC_URL = "https://api.shardeum.org";
const MAX_ROWS = 15;
const BLOCKS_TO_SCAN = 5;
const CACHE_MS = 15000;

let cache = { at: 0, data: null };

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now() + Math.random(), method, params })
  });

  if (!response.ok) {
    throw new Error(`Shardeum RPC HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "Shardeum RPC error");
  }
  return data.result;
}

function formatShm(value) {
  try {
    const wei = BigInt(value || "0x0");
    const whole = wei / 1000000000000000000n;
    const fraction = (wei % 1000000000000000000n)
      .toString()
      .padStart(18, "0")
      .replace(/0+$/, "");

    return fraction
      ? `${whole.toLocaleString("en-US")}.${fraction.slice(0, 9)}`
      : whole.toLocaleString("en-US");
  } catch {
    return "0";
  }
}

function txType(tx) {
  const to = String(tx?.to || "");
  const data = String(tx?.input || tx?.data || "0x").toLowerCase();

  // A native SHM transfer has a recipient and no calldata.
  if (to && (data === "0x" || data === "0x0")) return "TRANSFER";

  // Generic contract interaction. We intentionally do not guess STAKE,
  // UNSTAKE or DELETE without a known contract/event definition.
  return "CONTRACT";
}

function blockTime(timestamp) {
  const seconds = Number.parseInt(String(timestamp || "0x0"), 16);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(new Date(seconds * 1000)) + " IST";
}

async function getReceiptFee(tx) {
  try {
    const receipt = await rpc("eth_getTransactionReceipt", [tx.hash]);
    if (!receipt) return "—";

    const gasUsed = BigInt(receipt.gasUsed || "0x0");
    const gasPrice = BigInt(
      receipt.effectiveGasPrice ||
      receipt.gasPrice ||
      tx.gasPrice ||
      "0x0"
    );

    return formatShm((gasUsed * gasPrice).toString());
  } catch {
    return "—";
  }
}

async function buildActivities() {
  const latestHex = await rpc("eth_blockNumber", []);
  const latestNumber = Number.parseInt(latestHex, 16);
  const activities = [];

  for (let offset = 0; offset < BLOCKS_TO_SCAN && activities.length < MAX_ROWS; offset++) {
    const blockNumber = latestNumber - offset;
    if (blockNumber < 0) break;

    const blockHex = "0x" + blockNumber.toString(16);
    const block = await rpc("eth_getBlockByNumber", [blockHex, true]);
    if (!block || !Array.isArray(block.transactions)) continue;

    // Newest transactions first inside each block.
    const txs = [...block.transactions].reverse();

    for (const tx of txs) {
      if (activities.length >= MAX_ROWS) break;

      activities.push({
        key: tx.hash,
        type: txType(tx),
        block: blockNumber,
        time: blockTime(block.timestamp),
        amount: formatShm(tx.value),
        gas: await getReceiptFee(tx)
      });
    }
  }

  return { latestBlock: latestNumber, activities };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=20");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const now = Date.now();
    if (cache.data && now - cache.at < CACHE_MS) {
      return res.status(200).json(cache.data);
    }

    const result = await buildActivities();
    const payload = {
      success: true,
      latestBlock: result.latestBlock,
      activities: result.activities,
      updatedAt: new Date().toISOString()
    };

    cache = { at: now, data: payload };
    return res.status(200).json(payload);
  } catch (error) {
    console.error("blockchain-activity error:", error);
    return res.status(502).json({
      success: false,
      error: error?.message || "Unable to read Shardeum blockchain"
    });
  }
};
