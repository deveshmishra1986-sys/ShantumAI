const RPC_URL = "https://api.shardeum.org";
const BLOCKS_TO_SCAN = 12;
const MAX_ROWS = 15;
const CACHE_MS = 15000;

let cache = { at: 0, data: null };

async function rpc(method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Shardeum RPC HTTP ${response.status}`);
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error.message || "Shardeum RPC error");
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcBatch(requests) {
  if (!requests.length) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Shardeum RPC HTTP ${response.status}`);
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Invalid batch response from Shardeum RPC");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function hexToNumber(value) {
  const n = Number.parseInt(String(value || "0x0"), 16);
  return Number.isFinite(n) ? n : 0;
}

function formatShm(value) {
  try {
    const wei = BigInt(value || "0x0");
    const base = 1000000000000000000n;
    const whole = wei / base;
    const fraction = (wei % base).toString().padStart(18, "0").replace(/0+$/, "");
    return fraction
      ? `${whole.toLocaleString("en-US")}.${fraction.slice(0, 9)}`
      : whole.toLocaleString("en-US");
  } catch {
    return "0";
  }
}

function typeOfTx(tx) {
  const to = String(tx?.to || "");
  const input = String(tx?.input || tx?.data || "0x").toLowerCase();
  return to && (input === "0x" || input === "0x0") ? "TRANSFER" : "CONTRACT";
}

function formatTime(timestamp) {
  const seconds = hexToNumber(timestamp);
  if (!seconds) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(new Date(seconds * 1000)) + " IST";
}

async function build() {
  const latestHex = await rpc("eth_blockNumber");
  const latest = hexToNumber(latestHex);
  if (!latest) throw new Error("Could not read latest Shardeum block");

  // Read several recent blocks in one JSON-RPC batch so an empty latest block
  // does not leave the activity table empty.
  const blockRequests = [];
  for (let i = 0; i < BLOCKS_TO_SCAN; i++) {
    const number = latest - i;
    if (number < 0) break;
    blockRequests.push({
      jsonrpc: "2.0",
      id: i + 1,
      method: "eth_getBlockByNumber",
      params: ["0x" + number.toString(16), true]
    });
  }

  const blockResponses = await rpcBatch(blockRequests);
  const blocks = blockResponses
    .filter(r => r && !r.error && r.result)
    .map(r => r.result)
    .filter(b => Array.isArray(b.transactions));

  const txItems = [];
  for (const block of blocks) {
    const blockNumber = hexToNumber(block.number);
    for (const tx of block.transactions) {
      if (!tx || !tx.hash) continue;
      txItems.push({
        tx,
        blockNumber,
        timestamp: block.timestamp
      });
    }
  }

  txItems.sort((a, b) => {
    if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
    return String(b.tx.hash).localeCompare(String(a.tx.hash));
  });

  const selected = txItems.slice(0, MAX_ROWS);

  // Receipts are requested as one batch, keeping the public RPC traffic low.
  const receiptRequests = selected.map((item, index) => ({
    jsonrpc: "2.0",
    id: 1000 + index,
    method: "eth_getTransactionReceipt",
    params: [item.tx.hash]
  }));

  const receiptResponses = await rpcBatch(receiptRequests);
  const receiptByHash = new Map();
  for (const r of receiptResponses) {
    if (r && r.result && r.result.transactionHash) {
      receiptByHash.set(String(r.result.transactionHash).toLowerCase(), r.result);
    }
  }

  const activities = selected.map(item => {
    const tx = item.tx;
    const receipt = receiptByHash.get(String(tx.hash).toLowerCase());
    let gas = "—";

    try {
      if (receipt) {
        const used = BigInt(receipt.gasUsed || "0x0");
        const price = BigInt(
          receipt.effectiveGasPrice || receipt.gasPrice || tx.gasPrice || "0x0"
        );
        gas = formatShm((used * price).toString());
      }
    } catch {}

    return {
      key: tx.hash,
      type: typeOfTx(tx),
      block: item.blockNumber,
      time: formatTime(item.timestamp),
      amount: formatShm(tx.value),
      gas
    };
  });

  return {
    latestBlock: latest,
    scannedBlocks: blocks.length,
    transactionsFound: txItems.length,
    activities
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const now = Date.now();
    if (cache.data && now - cache.at < CACHE_MS) {
      return res.status(200).json(cache.data);
    }

    const result = await build();
    const payload = {
      success: true,
      latestBlock: result.latestBlock,
      scannedBlocks: result.scannedBlocks,
      transactionsFound: result.transactionsFound,
      activities: result.activities,
      updatedAt: new Date().toISOString()
    };

    cache = { at: now, data: payload };
    return res.status(200).json(payload);
  } catch (error) {
    console.error("blockchain-activity:", error);
    return res.status(502).json({
      success: false,
      error: error?.message || "Unable to read Shardeum blockchain"
    });
  }
}
