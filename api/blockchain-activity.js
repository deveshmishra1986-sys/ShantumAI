const RPC_URL = "https://api.shardeum.org";
const MAX_ROWS = 10;
const CACHE_MS = 15000;

let cache = { at: 0, data: null };

async function rpc(method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params
      }),
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Shardeum RPC HTTP ${response.status}`);

    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Invalid JSON from Shardeum RPC"); }

    if (data.error) throw new Error(data.error.message || "Shardeum RPC error");
    return data.result;
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

async function gasFee(tx) {
  try {
    const receipt = await rpc("eth_getTransactionReceipt", [tx.hash]);
    if (!receipt) return "—";
    const used = BigInt(receipt.gasUsed || "0x0");
    const price = BigInt(
      receipt.effectiveGasPrice || receipt.gasPrice || tx.gasPrice || "0x0"
    );
    return formatShm((used * price).toString());
  } catch {
    return "—";
  }
}

async function build() {
  const latestHex = await rpc("eth_blockNumber");
  const latest = hexToNumber(latestHex);
  const block = await rpc(
    "eth_getBlockByNumber",
    ["0x" + latest.toString(16), true]
  );

  if (!block || !Array.isArray(block.transactions)) {
    return { latestBlock: latest, activities: [] };
  }

  const txs = [...block.transactions].reverse().slice(0, MAX_ROWS);
  const activities = [];

  for (const tx of txs) {
    activities.push({
      key: tx.hash,
      type: typeOfTx(tx),
      block: latest,
      time: formatTime(block.timestamp),
      amount: formatShm(tx.value),
      gas: await gasFee(tx)
    });
  }

  return { latestBlock: latest, activities };
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
