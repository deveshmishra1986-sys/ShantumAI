// Shantum AI - Blockchain Activity API v5
// Vercel ES module. Uses standard Ethereum JSON-RPC transaction-index methods
// instead of relying on block.transactions[], which was empty on the public RPC.

const RPC = "https://api.shardeum.org";
const MAX_BLOCKS = 6;
const MAX_TX = 12;
const REQUEST_TIMEOUT = 12000;

async function rpc(method, params, id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: controller.signal,
      cache: "no-store"
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`RPC returned non-JSON (${r.status})`); }
    if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
    if (data.error) throw new Error(`${method}: ${data.error.message || JSON.stringify(data.error)}`);
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

function hexToNumber(v) {
  if (v == null) return 0;
  return Number.parseInt(v, 16);
}

function hexToBigInt(v) {
  try { return BigInt(v || "0x0"); } catch { return 0n; }
}

function formatShm(wei) {
  const w = typeof wei === "bigint" ? wei : hexToBigInt(wei);
  const whole = w / 1000000000000000000n;
  const frac = (w % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function classify(tx) {
  const value = hexToBigInt(tx?.value);
  const data = String(tx?.input || tx?.data || "0x");
  if (tx?.to && (data === "0x" || data === "0x0")) {
    return value > 0n ? "TRANSFER" : "CONTRACT";
  }
  return "CONTRACT";
}

function isoFromHexTimestamp(ts) {
  const seconds = hexToNumber(ts);
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "GET only" });
  }

  try {
    const latestHex = await rpc("eth_blockNumber", [], 1);
    const latest = hexToNumber(latestHex);
    const activities = [];
    const scanned = [];

    // Use eth_getBlockTransactionCountByNumber + eth_getTransactionByBlockNumberAndIndex.
    // This avoids relying on the empty `transactions` array returned by the tested block query.
    for (let offset = 0; offset < MAX_BLOCKS && activities.length < MAX_TX; offset++) {
      const blockNumber = latest - offset;
      if (blockNumber < 0) break;

      const blockHex = "0x" + blockNumber.toString(16);
      const countHex = await rpc(
        "eth_getBlockTransactionCountByNumber",
        [blockHex],
        10 + offset
      );
      const count = hexToNumber(countHex);
      scanned.push({ block: blockNumber, transactionCount: count });

      if (!count) continue;

      const limit = Math.min(count, MAX_TX - activities.length);

      // Fetch transactions sequentially to stay comfortably below public RPC limits.
      for (let i = 0; i < limit; i++) {
        const tx = await rpc(
          "eth_getTransactionByBlockNumberAndIndex",
          [blockHex, "0x" + i.toString(16)],
          100 + offset * 20 + i
        );
        if (!tx) continue;

        const block = await rpc(
          "eth_getBlockByNumber",
          [blockHex, false],
          500 + offset
        );

        let gasFeeWei = 0n;
        let receiptError = null;

        try {
          const receipt = await rpc(
            "eth_getTransactionReceipt",
            [tx.hash],
            700 + activities.length
          );
          if (receipt) {
            const gasUsed = hexToBigInt(receipt.gasUsed);
            const gasPrice = hexToBigInt(receipt.effectiveGasPrice || tx.gasPrice);
            gasFeeWei = gasUsed * gasPrice;
          }
        } catch (e) {
          receiptError = e.message;
        }

        activities.push({
          type: classify(tx),
          block: blockNumber,
          time: isoFromHexTimestamp(block?.timestamp),
          amountShm: formatShm(tx.value),
          gasFeeShm: formatShm(gasFeeWei),
          txHash: tx.hash,
          _receiptError: receiptError
        });

        if (activities.length >= MAX_TX) break;
      }
    }

    return res.status(200).json({
      success: true,
      latestBlock: latest,
      scannedBlocks: scanned,
      transactionsFound: activities.length,
      activities,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("blockchain-activity v5:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Blockchain API failed",
      rpc: RPC,
      updatedAt: new Date().toISOString()
    });
  }
}
