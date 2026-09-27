const https = require("https");

const RPC_URL = "https://api.shardeum.org";
const MAX_ROWS = 10;
const CACHE_MS = 15000;

let cache = { at: 0, data: null };

function rpc(method, params = []) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    });

    const req = https.request(RPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: 8000
    }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => text += chunk);
      res.on("end", () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Shardeum RPC HTTP ${res.statusCode}`));
          }
          const data = JSON.parse(text);
          if (data.error) {
            return reject(new Error(data.error.message || "Shardeum RPC error"));
          }
          resolve(data.result);
        } catch (e) {
          reject(new Error("Invalid JSON from Shardeum RPC"));
        }
      });
    });

    req.on("timeout", () => req.destroy(new Error("Shardeum RPC timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function hexToNumber(v) {
  const n = Number.parseInt(String(v || "0x0"), 16);
  return Number.isFinite(n) ? n : 0;
}

function formatShm(value) {
  try {
    const wei = BigInt(value || "0x0");
    const whole = wei / 1000000000000000000n;
    const fraction = (wei % 1000000000000000000n)
      .toString().padStart(18, "0").replace(/0+$/, "");
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
    const r = await rpc("eth_getTransactionReceipt", [tx.hash]);
    if (!r) return "—";
    const used = BigInt(r.gasUsed || "0x0");
    const price = BigInt(r.effectiveGasPrice || r.gasPrice || tx.gasPrice || "0x0");
    return formatShm((used * price).toString());
  } catch {
    return "—";
  }
}

async function build() {
  const latestHex = await rpc("eth_blockNumber");
  const latest = hexToNumber(latestHex);
  const block = await rpc("eth_getBlockByNumber", ["0x" + latest.toString(16), true]);

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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

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
};
