const EXPLORER_API =
  "https://explorer.shardeum.org/api/v2";

const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa".toLowerCase();

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

// Number of Blockscout log pages to inspect.
// Increase later if necessary.
const MAX_LOG_PAGES = 10;


// --------------------------------------------------
// Fetch JSON
// --------------------------------------------------

async function getJson(url) {

  const response = await fetch(url);

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid JSON response"
    );
  }
}


// --------------------------------------------------
// Get Sikka logs
// --------------------------------------------------

async function getSikkaLogs(cursor = null) {

  let url =
    `${EXPLORER_API}/addresses/` +
    `${SIKKA_CONTRACT}/logs`;

  if (cursor) {

    const params =
      new URLSearchParams();

    if (
      cursor.block_number !== undefined &&
      cursor.block_number !== null
    ) {
      params.set(
        "block_number",
        cursor.block_number
      );
    }

    if (
      cursor.index !== undefined &&
      cursor.index !== null
    ) {
      params.set(
        "index",
        cursor.index
      );
    }

    if (
      cursor.items_count !== undefined &&
      cursor.items_count !== null
    ) {
      params.set(
        "items_count",
        cursor.items_count
      );
    }

    url += `?${params.toString()}`;
  }

  return await getJson(url);
}


// --------------------------------------------------
// Is this a Sikka Trade event?
// --------------------------------------------------

function isTradeLog(log) {

  if (
    !log ||
    !Array.isArray(log.topics) ||
    log.topics.length === 0
  ) {
    return false;
  }

  return (
    log.topics[0].toLowerCase() ===
    TRADE_TOPIC.toLowerCase()
  );
}


// --------------------------------------------------
// Get token transfers for transaction
// --------------------------------------------------

async function getTokenTransfers(
  transactionHash
) {

  const url =
    `${EXPLORER_API}/transactions/` +
    `${transactionHash}/token-transfers?type=ERC-20`;

  try {

    const data =
      await getJson(url);

    return data.items || [];

  } catch (error) {

    console.log(
      "Transfer lookup failed:",
      transactionHash,
      error.message
    );

    return [];
  }
}


// --------------------------------------------------
// Convert token information
// --------------------------------------------------

function convertToken(transfer) {

  if (
    !transfer ||
    !transfer.token ||
    !transfer.token.address
  ) {
    return null;
  }

  const token =
    transfer.token;

  const address =
    token.address.toLowerCase();


  // Never show Sikka itself
  if (
    address === SIKKA_CONTRACT
  ) {
    return null;
  }


  return {

    address,

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
      null,

    holders:
      token.holders != null
        ? Number(token.holders)
        : null,

    total_supply:
      token.total_supply ??
      null,

    volume_24h:
      token.volume_24h ??
      null
  };
}


// --------------------------------------------------
// Process transactions
// --------------------------------------------------

async function processTransactions(
  transactionHashes,
  tokenMap
) {

  // Don't process the same transaction twice.
  const uniqueHashes =
    [
      ...new Set(
        transactionHashes
      )
    ];


  // Process a few at a time.
  const batchSize = 5;


  for (
    let i = 0;
    i < uniqueHashes.length;
    i += batchSize
  ) {

    const batch =
      uniqueHashes.slice(
        i,
        i + batchSize
      );


    const results =
      await Promise.all(
        batch.map(
          hash =>
            getTokenTransfers(hash)
        )
      );


    for (
      let j = 0;
      j < results.length;
      j++
    ) {

      const transfers =
        results[j];

      const transactionHash =
        batch[j];


      // Keep track of tokens found in THIS
      // transaction only.
      //
      // This prevents the two STM minting
      // transfers in one transaction from
      // being counted as two trades.

      const tokensInThisTrade =
        new Set();


      for (
        const transfer
        of transfers
      ) {

        const token =
          convertToken(
            transfer
          );


        if (!token) {
          continue;
        }


        if (
          tokensInThisTrade.has(
            token.address
          )
        ) {
          continue;
        }


        tokensInThisTrade.add(
          token.address
        );


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


      console.log(
        "Processed trade:",
        transactionHash,
        "tokens:",
        tokensInThisTrade.size
      );
    }
  }
}


// --------------------------------------------------
// MAIN API
// --------------------------------------------------

export default async function handler(
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


    const tokenMap =
      new Map();


    let cursor = null;

    let pagesRead = 0;

    let totalTradeTransactions = 0;


    // ------------------------------------------------
    // Read multiple pages of Sikka logs
    // ------------------------------------------------

    while (
      tokenMap.size < limit &&
      pagesRead < MAX_LOG_PAGES
    ) {

      console.log(
        "Reading Sikka log page:",
        pagesRead + 1
      );


      const logData =
        await getSikkaLogs(
          cursor
        );


      const logs =
        logData.items || [];


      console.log(
        "Logs on page:",
        logs.length
      );


      // ------------------------------------------------
      // Find Trade transactions
      // ------------------------------------------------

      const tradeTransactions =
        [];


      for (
        const log of logs
      ) {

        if (
          !isTradeLog(log)
        ) {
          continue;
        }


        const txHash =
          log.transaction_hash ||
          log.transactionHash;


        if (
          txHash
        ) {

          tradeTransactions.push(
            txHash
          );
        }
      }


      const uniqueTrades =
        [
          ...new Set(
            tradeTransactions
          )
        ];


      console.log(
        "Trade transactions on page:",
        uniqueTrades.length
      );


      totalTradeTransactions +=
        uniqueTrades.length;


      // ------------------------------------------------
      // Get actual token contracts
      // ------------------------------------------------

      await processTransactions(
        uniqueTrades,
        tokenMap
      );


      console.log(
        "Unique tokens so far:",
        tokenMap.size
      );


      // ------------------------------------------------
      // Enough tokens?
      // ------------------------------------------------

      if (
        tokenMap.size >= limit
      ) {
        break;
      }


      // ------------------------------------------------
      // Get next page
      // ------------------------------------------------

      if (
        !logData.next_page_params
      ) {

        console.log(
          "No more Sikka log pages."
        );

        break;
      }


      cursor =
        logData.next_page_params;


      pagesRead++;
    }


    // ------------------------------------------------
    // Sort by number of trades
    // ------------------------------------------------

    const items =
      [
        ...tokenMap.values()
      ]
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
      "s-maxage=60, stale-while-revalidate=300"
    );


    return res.status(200).json({

      success: true,

      items,

      total:
        items.length,

      tradeTransactions:
        totalTradeTransactions,

      pagesRead,

      hasMore:
        !!cursor &&
        items.length >= limit,

      source:
        "Sikka Trade + Blockscout"
    });


  } catch (error) {

    console.error(
      "TOKEN API ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error.message
    });
  }
}
