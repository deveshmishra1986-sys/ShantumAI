// api/tokens.js

const EXPLORER_API =
  "https://explorer.shardeum.org/api/v2";

const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

// Scan 5,000 blocks at a time
const BLOCK_STEP = 5000;


// --------------------------------------------------
// Get JSON
// --------------------------------------------------

async function getJson(url) {

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${url}`
    );
  }

  return await response.json();
}


// --------------------------------------------------
// Get latest block from Shardeum explorer
// --------------------------------------------------

async function getLatestBlock() {

  const data = await getJson(
    `${EXPLORER_API}/blocks?type=block`
  );

  if (
    data &&
    data.items &&
    data.items.length > 0
  ) {
    return Number(data.items[0].height);
  }

  throw new Error(
    "Unable to determine latest block"
  );
}


// --------------------------------------------------
// Get Sikka Trade logs
// --------------------------------------------------

async function getTradeLogs(
  fromBlock,
  toBlock
) {

  const RPC_URL =
    "https://api.shardeum.org";

  const response = await fetch(
    RPC_URL,
    {
      method: "POST",

      headers: {
        "content-type": "application/json"
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [
          {
            address: SIKKA_CONTRACT,

            fromBlock:
              "0x" +
              fromBlock.toString(16),

            toBlock:
              "0x" +
              toBlock.toString(16),

            topics: [
              TRADE_TOPIC
            ]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `RPC HTTP ${response.status}`
    );
  }

  const json =
    await response.json();

  if (json.error) {
    throw new Error(
      json.error.message ||
      "RPC error"
    );
  }

  return json.result || [];
}


// --------------------------------------------------
// Get token transfers for transaction
// --------------------------------------------------

async function getTransactionTokenTransfers(
  txHash
) {

  const url =
    `${EXPLORER_API}/transactions/` +
    `${txHash}/token-transfers?type=ERC-20`;

  try {

    const data =
      await getJson(url);

    return data.items || [];

  } catch (error) {

    console.log(
      "Token transfer lookup failed:",
      txHash,
      error.message
    );

    return [];
  }
}


// --------------------------------------------------
// Extract actual token from transfer
// --------------------------------------------------

function extractToken(transfer) {

  // Blockscout response has token object
  if (
    transfer &&
    transfer.token
  ) {

    const token =
      transfer.token;

    if (
      token.address
    ) {

      return {
        address:
          token.address.toLowerCase(),

        name:
          token.name ||
          "Unknown Token",

        symbol:
          token.symbol ||
          "-",

        decimals:
          token.decimals != null
            ? Number(token.decimals)
            : null,

        logo:
          token.icon_url ||
          "",

        exchange_rate:
          token.exchange_rate ??
          null
      };
    }
  }

  return null;
}


// --------------------------------------------------
// Process Trade transactions
// --------------------------------------------------

async function processTradeTransactions(
  logs,
  tokenMap
) {

  // Remove duplicate transaction hashes
  const txHashes = [
    ...new Set(
      logs
        .map(
          log =>
            log.transactionHash
        )
        .filter(Boolean)
    )
  ];

  console.log(
    "Trade transactions:",
    txHashes.length
  );


  // IMPORTANT:
  // Only process 5 transactions at once.
  // This keeps the Vercel function lightweight.
  const batchSize = 5;

  for (
    let i = 0;
    i < txHashes.length;
    i += batchSize
  ) {

    const batch =
      txHashes.slice(
        i,
        i + batchSize
      );

    const results =
      await Promise.all(
        batch.map(
          txHash =>
            getTransactionTokenTransfers(
              txHash
            )
        )
      );


    for (
      let j = 0;
      j < results.length;
      j++
    ) {

      const transfers =
        results[j];

      for (
        const transfer
        of transfers
      ) {

        const token =
          extractToken(
            transfer
          );

        if (!token) {
          continue;
        }


        // Don't accidentally add Sikka itself
        if (
          token.address ===
          SIKKA_CONTRACT.toLowerCase()
        ) {
          continue;
        }


        // Existing token?
        if (
          tokenMap.has(
            token.address
          )
        ) {

          const existing =
            tokenMap.get(
              token.address
            );

          existing.tradeCount += 1;

        } else {

          token.tradeCount = 1;

          tokenMap.set(
            token.address,
            token
          );
        }
      }
    }
  }
}


// --------------------------------------------------
// MAIN API
// --------------------------------------------------

module.exports =
async function handler(
  req,
  res
) {

  try {

    const limit =
      Math.min(
        Math.max(
          parseInt(
            req.query.limit ||
            DEFAULT_LIMIT
          ),
          1
        ),
        MAX_LIMIT
      );


    let beforeBlock =
      req.query.beforeBlock
        ? Number(
            req.query.beforeBlock
          )
        : null;


    // ------------------------------------------------
    // Get latest block
    // ------------------------------------------------

    if (
      !beforeBlock ||
      !Number.isFinite(
        beforeBlock
      )
    ) {

      beforeBlock =
        await getLatestBlock();
    }


    const tokenMap =
      new Map();


    let currentToBlock =
      beforeBlock;

    let scannedFrom =
      null;

    let scannedTo =
      null;


    // ------------------------------------------------
    // Scan backwards
    // ------------------------------------------------

    while (
      tokenMap.size < limit &&
      currentToBlock > 0
    ) {

      const currentFromBlock =
        Math.max(
          0,
          currentToBlock -
            BLOCK_STEP +
            1
        );


      console.log(
        `Scanning ${currentFromBlock} - ${currentToBlock}`
      );


      let tradeLogs = [];


      try {

        tradeLogs =
          await getTradeLogs(
            currentFromBlock,
            currentToBlock
          );

      } catch (error) {

        console.log(
          "Trade log error:",
          error.message
        );

        // Move backwards
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


      console.log(
        "Trade logs found:",
        tradeLogs.length
      );


      // ------------------------------------------------
      // Get actual token contracts
      // from Blockscout token transfers
      // ------------------------------------------------

      await processTradeTransactions(
        tradeLogs,
        tokenMap
      );


      // Move backwards
      currentToBlock =
        currentFromBlock - 1;


      // Safety limit
      if (
        scannedTo -
          scannedFrom >
          500000
      ) {

        break;
      }
    }


    // ------------------------------------------------
    // Sort by number of Sikka trades
    // ------------------------------------------------

    const items =
      [...tokenMap.values()]
        .sort(
          (a, b) =>
            b.tradeCount -
            a.tradeCount
        )
        .slice(
          0,
          limit
        );


    // ------------------------------------------------
    // Response
    // ------------------------------------------------

    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=120"
    );


    return res
      .status(200)
      .json({

        items,

        total:
          items.length,

        nextBeforeBlock:
          currentToBlock > 0
            ? currentToBlock
            : null,

        scannedFrom,

        scannedTo,

        source:
          "Sikka Trade + Blockscout Token Transfers"
      });


  } catch (error) {

    console.error(
      "API ERROR:",
      error
    );


    return res
      .status(500)
      .json({

        error:
          error.message,

        message:
          "Token API failed"
      });
  }
};
