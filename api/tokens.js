const EXPLORER_API =
  "https://explorer.shardeum.org/api/v2";

const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa"
    .toLowerCase();

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;


// --------------------------------------------------
// Fetch JSON
// --------------------------------------------------

async function getJson(url) {

  const response =
    await fetch(url);

  const text =
    await response.text();

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
// Get Sikka contract logs
// --------------------------------------------------

async function getSikkaLogs() {

  const url =
    `${EXPLORER_API}/addresses/` +
    `${SIKKA_CONTRACT}/logs`;

  return await getJson(url);
}


// --------------------------------------------------
// Check Trade event
// --------------------------------------------------

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
    TRADE_TOPIC
  );
}


// --------------------------------------------------
// Get token transfers
// --------------------------------------------------

async function getTokenTransfers(
  transactionHash
) {

  const url =
    `${EXPLORER_API}/transactions/` +
    `${transactionHash}/token-transfers`;

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
// Convert Blockscout token
// --------------------------------------------------

function convertToken(
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

  const address =
    token.address.toLowerCase();


  // Never include Sikka itself
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
// MAIN
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


    // ------------------------------------------------
    // Get Sikka logs
    // ------------------------------------------------

    const logData =
      await getSikkaLogs();


    const logs =
      logData.items || [];


    console.log(
      "Sikka logs:",
      logs.length
    );


    // ------------------------------------------------
    // Find Trade transactions
    // ------------------------------------------------

    const transactions = [];


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

        transactions.push(
          txHash
        );
      }
    }


    // Remove duplicate transactions
    const uniqueTransactions =
      [
        ...new Set(
          transactions
        )
      ];


    console.log(
      "Trade transactions:",
      uniqueTransactions.length
    );


    // ------------------------------------------------
    // Token map
    // ------------------------------------------------

    const tokenMap =
      new Map();


    // ------------------------------------------------
    // Process transactions
    // ------------------------------------------------

    // Keep this small so Vercel
    // does not get overloaded.

    const batchSize = 3;


    for (
      let i = 0;

      i < uniqueTransactions.length;

      i += batchSize
    ) {

      const batch =
        uniqueTransactions.slice(
          i,
          i + batchSize
        );


      const results =
        await Promise.all(
          batch.map(
            tx =>
              getTokenTransfers(tx)
          )
        );


      for (
        const transfers
        of results
      ) {

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


      // Stop as soon as we have enough
      if (
        tokenMap.size >= limit
      ) {
        break;
      }
    }


    // ------------------------------------------------
    // Sort
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
        uniqueTransactions.length,

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
