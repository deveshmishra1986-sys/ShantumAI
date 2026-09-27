const EXPLORER = "https://explorer.shardeum.org";
const MAX_TRANSACTIONS = 20;
const TIMEOUT_MS = 12000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Explorer returned non-JSON (HTTP ${response.status})`);
    }

    if (!response.ok) {
      throw new Error(
        `Explorer HTTP ${response.status}: ${
          data?.message || data?.error || "request failed"
        }`
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function toBigInt(value) {
  if (value === null || value === undefined || value === "") return 0n;

  try {
    const s = String(value);
    return s.startsWith("0x") || s.startsWith("0X")
      ? BigInt(s)
      : BigInt(s);
  } catch {
    return 0n;
  }
}

function formatShm(value) {
  const wei = toBigInt(value);
  const base = 1000000000000000000n;
  const whole = wei / base;
  const fraction = (wei % base)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function normalizeType(tx) {
  const types = Array.isArray(tx?.transaction_types)
    ? tx.transaction_types.map(x => String(x).toLowerCase())
    : [];

  if (
    types.some(x =>
      x.includes("coin_transfer") ||
      x.includes("coin transfer") ||
      x === "transfer"
    )
  ) {
    return "TRANSFER";
  }

  if (types.some(x => x.includes("stake") && x.includes("unstake"))) {
    return "UNSTAKE";
  }

  if (types.some(x => x.includes("unstake"))) {
    return "UNSTAKE";
  }

  if (types.some(x => x.includes("stake"))) {
    return "STAKE";
  }

  if (types.some(x => x.includes("contract"))) {
    return "CONTRACT";
  }

  if (tx?.method) {
    return "CONTRACT";
  }

  return "TRANSFER";
}

function normalizeBlock(tx) {
  const candidates = [
    tx?.block,
    tx?.block_number,
    tx?.blockNumber
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

function normalizeTime(tx) {
  const value = tx?.timestamp;

  if (!value) return null;

  const ms = Date.parse(String(value));
  if (Number.isFinite(ms)) {
    return new Date(ms).toISOString();
  }

  const n = Number(value);
  if (Number.isFinite(n) && n > 0) {
    // Support milliseconds or seconds if an installation returns numeric time.
    return new Date(n < 100000000000 ? n * 1000 : n).toISOString();
  }

  return null;
}

function getAmountWei(tx) {
  // Blockscout v2 transaction objects expose the native transaction value.
  return tx?.value ?? "0";
}

function getGasFeeWei(tx) {
  // Blockscout v2 exposes the calculated transaction fee as fee.value.
  if (tx?.fee?.value !== undefined) return tx.fee.value;

  // Fallback if an installation exposes gas used and gas price separately.
  if (tx?.gas_used !== undefined && tx?.gas_price !== undefined) {
    return toBigInt(tx.gas_used) * toBigInt(tx.gas_price);
  }

  if (tx?.gasUsed !== undefined && tx?.gasPrice !== undefined) {
    return toBigInt(tx.gasUsed) * toBigInt(tx.gasPrice);
  }

  return "0";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "GET only"
    });
  }

  try {
    const url =
      `${EXPLORER}/api/v2/transactions?limit=${MAX_TRANSACTIONS}` +
      `&_=${Date.now()}`;

    const data = await fetchJson(url);

    const source = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.transactions)
        ? data.transactions
        : [];

    const activities = source
      .map(tx => ({
        type: normalizeType(tx),
        block: normalizeBlock(tx),
        time: normalizeTime(tx),
        amountShm: formatShm(getAmountWei(tx)),
        gasFeeShm: formatShm(getGasFeeWei(tx))
      }))
      .filter(x => x.block > 0);

    return res.status(200).json({
      success: true,
      source: "Shardeum Explorer / Blockscout API v2",
      transactionsFound: activities.length,
      activities,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("blockchain-activity v7:", error);

    return res.status(502).json({
      success: false,
      error: error?.message || "Unable to load Shardeum blockchain activity",
      source: `${EXPLORER}/api/v2/transactions`,
      updatedAt: new Date().toISOString()
    });
  }
}
