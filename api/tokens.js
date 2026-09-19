// api/tokens.js

const EXPLORER_API =
  "https://explorer.shardeum.org/api/v2";

const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const DEFAULT_LIMIT = 50;


// ----------------------------------------------------
// Fetch JSON
// ----------------------------------------------------

async function getJson(url) {

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }

  return await response.json();
}


// ----------------------------------------------------
// Get Sikka logs from Blockscout
// ----------------------------------------------------

async function getSikkaLogs(cursor) {

  let url =
    `${EXPLORER_API}/addresses/` +
    `${SIKKA_CONTRACT}/logs`;

  if (cursor) {

    const params =
      new URLSearchParams();

    if (
      cursor.block_number !== undefined
    ) {
      params.set(
        "block_number",
        cursor.block_number
      );
    }

    if (
      cursor.index !== undefined
    ) {
      params.set(
        "index",
        cursor.index
      );
    }

    if (
      cursor.items_count !== undefined
    ) {
      params.set(
        "items_count",
        cursor.items_count
      );
    }

    url += "?" + params.toString();
  }

  return await getJson(url);
}


// ----------------------------------------------------
// Check whether a log is Sikka Trade event
// ----------------------------------------------------

function isTradeLog(log) {

  if (
    !log ||
    !log.topics ||
    !log.topics.length
  ) {
    return false;
  }

  return (
    log.topics[0].toLowerCase() ===
    TRADE_TOPIC.toLowerCase()
  );
}


// ----------------------------------------------------
// Get token transfers for transaction
// ----------------------------------------------------

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
      "Token transfer error:",
      transactionHash,
      error.message
    );

    return [];
  }
}


// ----------------------------------------------------
// Extract actual token from Blockscout transfer
// ----------------------------------------------------

function getTokenFromTransfer(
  transfer
) {

  if (
    !transfer ||
    !transfer.token ||
    !transfer.token.address
  ) {
    return null;
  }

  const token =
    transfer.token;

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
      token.decimals !== null &&
      token.decimals !== undefined
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


// ----------------------------------------------------
// Process transaction hashes
// ----------------------------------------------------

async function processTransactions(
  transactionHashes,
  tokenMap
) {

  // Process only 3 at a time
  // to keep Vercel stable.

  const batchSize = 3;

  for (
    let i = 0;
    i < transactionHashes.length;
    i += batchSize
  ) {

    const batch =
      transactionHashes.slice(
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

      for (
        const transfer of transfers
      ) {

        const token =
          getTokenFromTransfer(
            transfer
          );

        if (!token) {
          continue;
        }

        // Ignore Sikka itself
        if (
          token.address ===
          SIKKA_CONTRACT.toLowerCase()
        ) {
          continue;
        }

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


// ----------------------------------------------------
// MAIN
// ----------------------------------------------------

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
        50
      );


    const tokenMap =
      new Map();


    let cursor = null;

    let pagesRead = 0;

    let tradeTransactions = [];

    let lastCursor = null;


    // ------------------------------------------------
    // Read Blockscout Sikka logs
    // ------------------------------------------------

    while (
      tokenMap.size < limit &&
      pagesRead < 20
    ) {

      console.log(
        "Reading Sikka log page:",
        pagesRead + 1
      );


      const data =
        await getSikkaLogs(
          cursor
        );


      const logs =
        data.items || [];


      console.log(
        "Logs returned:",
        logs.length
      );


      // Find Trade events
      for (
        const log of logs
      ) {

        if (
          isTradeLog(log) &&
          log.transaction_hash
        ) {

          tradeTransactions.push(
            log.transaction_hash
          );
        }

        // Some Blockscout versions
        // use transactionHash.
        else if (
          isTradeLog(log) &&
          log.transactionHash
        ) {

          tradeTransactions.push(
            log.transactionHash
          );
        }
      }


      // Remove duplicate transactions
      tradeTransactions =
        [
          ...new Set(
            tradeTransactions
          )
        ];


      console.log(
        "Trade transactions:",
        tradeTransactions.length
      );


      // ------------------------------------------------
      // Process transactions found so far
      // ------------------------------------------------

      await processTransactions(
        tradeTransactions,
        tokenMap
      );


      // ------------------------------------------------
      // Stop if enough tokens
      // ------------------------------------------------

      if (
        tokenMap.size >= limit
      ) {
        break;
      }


      // ------------------------------------------------
      // Pagination
      // ------------------------------------------------

      if (
        !data.next_page_params
      ) {
        break;
      }


      cursor =
        data.next_page_params;

      lastCursor =
        cursor;

      pagesRead++;
    }


    // ------------------------------------------------
    // Sort
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
      "s-maxage=60, stale-while-revalidate=300"
    );


    return res.status(200).json({

      items,

      total:
        items.length,

      nextCursor:
        lastCursor,

      pagesRead,

      tradeTransactions:
        tradeTransactions.length,

      source:
        "Sikka Blockscout Logs + Token Transfers"
    });


  } catch (error) {

    console.error(
      "TOKEN API ERROR:",
      error
    );


    return res.status(500).json({

      error:
        error.message,

      message:
        "Token API failed"
    });
  }
};
