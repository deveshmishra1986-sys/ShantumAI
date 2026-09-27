const RPC_URL = "https://api.shardeum.org";

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
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}: ${text.slice(0,300)}`);
    const data = JSON.parse(text);
    if (data.error) throw new Error(data.error.message || "RPC error");
    return data.result;
  } finally { clearTimeout(timer); }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") return res.status(405).json({success:false,error:"GET only"});
  try {
    const latestHex = await rpc("eth_blockNumber");
    const latest = Number.parseInt(latestHex, 16);
    const blockHex = "0x" + latest.toString(16);
    const blockFull = await rpc("eth_getBlockByNumber", [blockHex, true]);
    const blockHashes = await rpc("eth_getBlockByNumber", [blockHex, false]);
    const txs = Array.isArray(blockFull?.transactions) ? blockFull.transactions : [];
    const sample = txs.slice(0, 2).map(tx => ({
      hash: tx?.hash || null,
      from: tx?.from || null,
      to: tx?.to || null,
      value: tx?.value || null,
      gas: tx?.gas || null,
      gasPrice: tx?.gasPrice || null,
      input: tx?.input || tx?.data || null,
      keys: tx && typeof tx === "object" ? Object.keys(tx) : []
    }));
    const hashTxs = Array.isArray(blockHashes?.transactions) ? blockHashes.transactions : [];
    return res.status(200).json({
      success:true,
      latestBlock: latest,
      latestBlockHex: latestHex,
      fullBlockFound: !!blockFull,
      fullBlockKeys: blockFull && typeof blockFull === "object" ? Object.keys(blockFull) : [],
      transactionArrayIsArray: Array.isArray(blockFull?.transactions),
      transactionCountFull: txs.length,
      transactionCountHashes: hashTxs.length,
      sampleTransactions: sample,
      timestamp: blockFull?.timestamp || null,
      rawTransactionFieldType: Array.isArray(blockFull?.transactions) ? (txs.length ? typeof txs[0] : "empty-array") : typeof blockFull?.transactions,
      updatedAt:new Date().toISOString()
    });
  } catch (error) {
    console.error("blockchain diagnostic:", error);
    return res.status(502).json({success:false,error:error?.message || "Diagnostic failed"});
  }
}
