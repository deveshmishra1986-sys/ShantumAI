const DEFAULT_COLLECTOR = "https://explorer.shardeum.org";
const MAX_TRANSACTIONS = 20;
const TIMEOUT_MS = 12000;

function hexOrDecimalToBigInt(value) {
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
  const wei = typeof value === "bigint" ? value : hexOrDecimalToBigInt(value);
  const base = 1000000000000000000n;
  const whole = wei / base;
  const fraction = (wei % base).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function transactionType(tx) {
  const raw = String(tx?.transactionType ?? "").toLowerCase();

  // The Collector API exposes a transactionType field. The documented
  // example uses transactionType 0 for a normal EVM transaction.
  if (raw === "0" || raw === "transfer") return "TRANSFER";

  // Do not guess STAKE/UNSTAKE/DELETE from arbitrary EVM calldata.
  // If the indexer supplies a textual type, preserve the useful category.
  if (raw.includes("stake") && raw.includes("unstake")) return "UNSTAKE";
  if (raw.includes("stake")) return "STAKE";
  if (raw.includes("reward")) return "REWARD";

  return "CONTRACT";
}

function pickReceipt(tx) {
  return (
    tx?.wrappedEVMAccount?.readableReceipt ||
    tx?.readableReceipt ||
    tx?.receipt ||
    tx?.wrappedEVMAccount?.receipt ||
    null
  );
}

function getValueWei(tx, receipt) {
  return (
    tx?.wrappedEVMAccount?.readableReceipt?.value ??
    receipt?.value ??
    tx?.value ??
    tx?.wrappedEVMAccount?.amountSpent ??
    "0x0"
  );
}

function getGasFeeWei(tx, receipt) {
  const gasUsed =
    receipt?.gasUsed ??
    tx?.wrappedEVMAccount?.readableReceipt?.gasUsed ??
    tx?.gasUsed;

  const gasPrice =
    receipt?.effectiveGasPrice ??
    receipt?.gasPrice ??
    tx?.effectiveGasPrice ??
    tx?.gasPrice ??
    tx?.wrappedEVMAccount?.readableReceipt?.gasPrice;

  if (gasUsed === undefined || gasPrice === undefined) return 0n;

  return hexOrDecimalToBigInt(gasUsed) * hexOrDecimalToBigInt(gasPrice);
}

function normalizeTimestamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Collector timestamps are documented in milliseconds.
  return new Date(n).toISOString();
}

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
      throw new Error(`Indexer returned non-JSON (HTTP ${response.status})`);
    }

    if (!response.ok) {
      throw new Error(
        `Indexer HTTP ${response.status}: ${data?.error || data?.message || "request failed"}`
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
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
    // Optional Vercel environment override:
    // SHARDEUM_COLLECTOR_URL=https://your-collector-host
    // Otherwise the official Shardeum Explorer host is used.
    const base = (
      process.env.SHARDEUM_COLLECTOR_URL ||
      DEFAULT_COLLECTOR
    ).replace(/\/+$/, "");

    const url = new URL(`${base}/api/transaction`);
    url.searchParams.set("count", String(MAX_TRANSACTIONS));
    url.searchParams.set("page", "1");
    url.searchParams.set("_", String(Date.now()));

    const data = await fetchJson(url.toString());

    if (!data || data.success === false) {
      throw new Error(data?.error || "Shardeum transaction indexer failed");
    }

    const sourceTransactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];

    const activities = sourceTransactions
      .map((tx) => {
        const receipt = pickReceipt(tx);
        const gasFeeWei = getGasFeeWei(tx, receipt);
        const amountWei = getValueWei(tx, receipt);

        return {
          type: transactionType(tx),
          block: Number(tx?.blockNumber ?? receipt?.blockNumber ?? 0),
          time: normalizeTimestamp(tx?.timestamp),
          amountShm: formatShm(amountWei),
          gasFeeShm: formatShm(gasFeeWei)
        };
      })
      .filter((x) => Number.isFinite(x.block) && x.block > 0)
      .sort((a, b) => {
        const ta = a.time ? Date.parse(a.time) : 0;
        const tb = b.time ? Date.parse(b.time) : 0;
        return tb - ta || b.block - a.block;
      });

    return res.status(200).json({
      success: true,
      source: "Shardeum Collector API",
      sourceUrl: `${base}/api/transaction`,
      transactionsFound: activities.length,
      activities,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("blockchain-activity v6:", error);

    return res.status(502).json({
      success: false,
      error: error?.message || "Unable to load Shardeum blockchain activity",
      hint:
        "The official Collector API is documented at /api/transaction. " +
        "If the public Explorer does not expose that route in your deployment, " +
        "set SHARDEUM_COLLECTOR_URL in Vercel to your approved Collector host.",
      updatedAt: new Date().toISOString()
    });
  }
}
