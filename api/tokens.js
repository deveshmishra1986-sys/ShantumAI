// api/tokens.js

const RPC_URL = "https://api.shardeum.org";

// Sikka.fun contract
const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa".toLowerCase();

// Sikka Trade event
const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

// ERC20 Transfer event
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const BLOCK_STEP = 5000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

// ----------------------------------------------------
// JSON RPC
// ----------------------------------------------------

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message || "RPC error");
  }

  return json.result;
}

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------

function hexToNumber(hex) {
  return parseInt(hex, 16);
}

function topicAddress(topic) {
  if (!topic) return null;

  return "0x" + topic.slice(-40).toLowerCase();
}

function cleanString(value) {
  if (!value) return null;

  return String(value)
    .replace(/\0/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

// ----------------------------------------------------
// Decode ERC20 metadata
// ----------------------------------------------------

function decodeString(data) {
  if (!data || data === "0x") {
    return null;
  }

  try {
    const hex = data.slice(2);

    // Standard ABI dynamic string
    if (hex.length >= 128) {
      const offset = parseInt(hex.slice(0, 64), 16);

      if (
        Number.isFinite(offset) &&
        offset * 2 + 64 <= hex.length
      ) {
        const lengthStart = offset * 2;

        const length = parseInt(
          hex.slice(lengthStart, lengthStart + 64),
          16
        );

        const dataStart = lengthStart + 64;
        const dataEnd = dataStart + length * 2;

        if (dataEnd <= hex.length) {
          const bytes = hex.slice(dataStart, dataEnd);

          return cleanString(
            Buffer.from(bytes, "hex").toString("utf8")
          );
        }
      }
    }

    // bytes32 fallback
    const bytes = hex.slice(0, 64);

    if (bytes) {
      return cleanString(
        Buffer.from(bytes, "hex").toString("utf8")
      );
    }
  } catch (error) {
    console.log("decodeString error:", error.message);
  }

  return null;
}

// ----------------------------------------------------
// Read ERC20 metadata
// ----------------------------------------------------

async function getERC20Metadata(address) {
  const result = {
    name: null,
    symbol: null,
    decimals: null,
  };

  // name()
  try {
    const value = await rpc("eth_call", [
      {
        to: address,
        data: "0x06fdde03",
      },
      "latest",
    ]);

    result.name = decodeString(value);
  } catch (e) {
    console.log("name() failed:", address, e.message);
  }

  // symbol()
  try {
    const value = await rpc("eth_call", [
      {
        to: address,
        data: "0x95d89b41",
      },
      "latest",
    ]);

    result.symbol = decodeString(value);
  } catch (e) {
    console.log("symbol() failed:", address, e.message);
  }

  // decimals()
  try {
    const value = await rpc("eth_call", [
      {
        to: address,
        data: "0x313ce567",
      },
      "latest",
    ]);

    if (value && value !== "0x") {
      result.decimals = hexToNumber(value);
    }
  } catch (e) {
    console.log("decimals() failed:", address, e.message);
  }

  return result;
}

// ----------------------------------------------------
// Get transaction receipt
// ----------------------------------------------------

async function getReceipt(txHash) {
  try {
    return await rpc("eth_getTransactionReceipt", [txHash]);
  } catch (error) {
    console.log(
      "Receipt failed:",
      txHash,
      error.message
    );

    return null;
  }
}

// ----------------------------------------------------
// Extract actual ERC20 token contracts
// from Transfer logs
// ----------------------------------------------------

function extractTokenContracts(receipt) {
  const addresses = new Set();

  if (!receipt || !Array.isArray(receipt.logs)) {
    return [];
  }

  for (const log of receipt.logs) {
    if (!log || !Array.isArray(log.topics)) {
      continue;
    }

    if (
      log.topics[0] &&
      log.topics[0].toLowerCase() ===
        TRANSFER_TOPIC.toLowerCase()
    ) {
      const tokenAddress =
        log.address?.toLowerCase();

      if (!tokenAddress) continue;

      // Don't treat Sikka itself as a token
      if (tokenAddress === SIKKA_CONTRACT) {
        continue;
      }

      addresses.add(tokenAddress);
    }
  }

  return [...addresses];
}

// ----------------------------------------------------
// Scan Sikka Trade events
// ----------------------------------------------------

async function getTradeLogs(fromBlock, toBlock) {
  return await rpc("eth_getLogs", [
    {
      address: SIKKA_CONTRACT,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
      topics: [TRADE_TOPIC],
    },
  ]);
}

// ----------------------------------------------------
// Process one Trade transaction
// ----------------------------------------------------

async function processTradeLog(log) {
  if (!log.transactionHash) {
    return [];
  }

  const receipt = await getReceipt(
    log.transactionHash
  );

  if (!receipt) {
    return [];
  }

  return extractTokenContracts(receipt);
}

// ----------------------------------------------------
// Concurrency helper
// ----------------------------------------------------

async function mapWithConcurrency(
  items,
  concurrency,
  worker
) {
  const results = new Array(items.length);

  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      try {
        results[index] = await worker(
          items[index],
          index
        );
      } catch (error) {
        console.log(
          "Worker error:",
          error.message
        );

        results[index] = null;
      }
    }
  }

  const workers = [];

  const workerCount = Math.min(
    concurrency,
    items.length
  );

  for (let i = 0; i < workerCount; i++) {
    workers.push(runWorker());
  }

  await Promise.all(workers);

  return results;
}

// ----------------------------------------------------
// Get metadata for tokens
// ----------------------------------------------------

async function getTokenMetadata(address) {
  // Try Blockscout first
  try {
    const response = await fetch(
      `https://explorer.shardeum.org/api/v2/tokens/${address}`
    );

    if (response.ok) {
      const data = await response.json();

      if (data) {
        const name =
          data.name ||
          data.token?.name ||
          null;

        const symbol =
          data.symbol ||
          data.token?.symbol ||
          null;

        const decimals =
          data.decimals ??
          data.token?.decimals ??
          null;

        const logo =
          data.icon_url ||
          data.logo ||
          data.token?.icon_url ||
          "";

        const exchangeRate =
          data.exchange_rate ??
          null;

        if (name || symbol || decimals !== null) {
          return {
            name: name || "Unknown Token",
            symbol: symbol || "-",
            logo,
            exchange_rate: exchangeRate,
            decimals:
              decimals !== null
                ? Number(decimals)
                : null,
          };
        }
      }
    }
  } catch (error) {
    console.log(
      "Blockscout token API failed:",
      address,
      error.message
    );
  }

  // Direct ERC20 calls
  const metadata =
    await getERC20Metadata(address);

  return {
    name: metadata.name || "Unknown Token",
    symbol: metadata.symbol || "-",
    logo: "",
    exchange_rate: null,
    decimals: metadata.decimals,
  };
}

// ----------------------------------------------------
// Main API
// ----------------------------------------------------

module.exports = async function handler(
  req,
  res
) {
  try {
    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit || DEFAULT_LIMIT),
        1
      ),
      MAX_LIMIT
    );

    let beforeBlock = req.query.beforeBlock
      ? parseInt(req.query.beforeBlock)
      : null;

    const latestBlock = hexToNumber(
      await rpc("eth_blockNumber", [])
    );

    if (
      !beforeBlock ||
      !Number.isFinite(beforeBlock)
    ) {
      beforeBlock = latestBlock;
    }

    const tokenTradeCounts = new Map();

    let currentToBlock = beforeBlock;

    let scannedFrom = null;
    let scannedTo = null;

    // ------------------------------------------------
    // Keep scanning until we have enough tokens
    // ------------------------------------------------

    while (
      tokenTradeCounts.size < limit &&
      currentToBlock > 0
    ) {
      const currentFromBlock = Math.max(
        0,
        currentToBlock - BLOCK_STEP + 1
      );

      console.log(
        `Scanning Sikka trades ${currentFromBlock} -> ${currentToBlock}`
      );

      let tradeLogs = [];

      try {
        tradeLogs = await getTradeLogs(
          currentFromBlock,
          currentToBlock
        );
      } catch (error) {
        console.log(
          "Trade log error:",
          error.message
        );

        currentToBlock =
          currentFromBlock - 1;

        continue;
      }

      scannedFrom =
        scannedFrom === null
          ? currentFromBlock
          : Math.min(
              scannedFrom,
              currentFromBlock
            );

      scannedTo =
        scannedTo === null
          ? currentToBlock
          : Math.max(
              scannedTo,
              currentToBlock
            );

      // ------------------------------------------------
      // Remove duplicate transaction hashes
      // ------------------------------------------------

      const uniqueTransactions =
        new Map();

      for (const log of tradeLogs) {
        if (
          log.transactionHash &&
          !uniqueTransactions.has(
            log.transactionHash
          )
        ) {
          uniqueTransactions.set(
            log.transactionHash,
            log
          );
        }
      }

      const logsToProcess =
        [...uniqueTransactions.values()];

      // ------------------------------------------------
      // IMPORTANT:
      // Only 5 RPC receipt requests at once
      // ------------------------------------------------

      const receiptResults =
        await mapWithConcurrency(
          logsToProcess,
          5,
          async (log) => {
            return await processTradeLog(log);
          }
        );

      // ------------------------------------------------
      // Count actual token contracts
      // ------------------------------------------------

      for (
        let i = 0;
        i < receiptResults.length;
        i++
      ) {
        const tokenAddresses =
          receiptResults[i] || [];

        for (const address of tokenAddresses) {
          const current =
            tokenTradeCounts.get(address) || 0;

          tokenTradeCounts.set(
            address,
            current + 1
          );
        }
      }

      currentToBlock =
        currentFromBlock - 1;

      // Safety limit
      if (
        scannedFrom !== null &&
        scannedTo !== null &&
        scannedTo - scannedFrom >
          500000
      ) {
        break;
      }
    }

    // ------------------------------------------------
    // Sort tokens by trade count
    // ------------------------------------------------

    const sortedTokens =
      [...tokenTradeCounts.entries()]
        .sort((a, b) => {
          return b[1] - a[1];
        })
        .slice(0, limit);

    // ------------------------------------------------
    // Metadata lookup
    //
    // IMPORTANT:
    // Only 5 tokens at a time.
    // This avoids hammering Shardeum RPC.
    // ------------------------------------------------

    const metadataResults =
      await mapWithConcurrency(
        sortedTokens,
        5,
        async ([address, tradeCount]) => {
          const metadata =
            await getTokenMetadata(address);

          return {
            address,
            ...metadata,
            tradeCount,
          };
        }
      );

    const items =
      metadataResults.filter(Boolean);

    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=120"
    );

    return res.status(200).json({
      items,

      total: items.length,

      nextBeforeBlock:
        currentToBlock > 0
          ? currentToBlock
          : null,

      scannedFrom,
      scannedTo,

      // Debug information
      source: "Sikka Trade -> ERC20 Transfer logs",
    });
  } catch (error) {
    console.error(
      "Token API error:",
      error
    );

    return res.status(500).json({
      error: error.message,
    });
  }
};
