const SIКKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const BLOCKSCOUT_API =
  "https://explorer.shardeum.org/api/v2";

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const PAGE_SIZE = 15;
const MAX_LOG_PAGES = 5;


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function encodeCursor(value) {
  if (!value) return "";

  return Buffer.from(
    JSON.stringify(value)
  ).toString("base64url");
}


function decodeCursor(value) {
  if (!value) return null;

  try {
    return JSON.parse(
      Buffer.from(
        value,
        "base64url"
      ).toString("utf8")
    );
  } catch {
    return null;
  }
}


async function fetchJson(url) {

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} - ${url}`
    );
  }

  return response.json();
}


// --------------------------------------------------
// GET SIKKA TRADE LOGS
// --------------------------------------------------

async function getSikkaLogs(cursor) {

  let url =
    `${BLOCKSCOUT_API}/addresses/${SIКKA_CONTRACT}/logs`;

  if (cursor) {

    const params = new URLSearchParams();

    if (cursor.block_number !== undefined) {
      params.set(
        "block_number",
        cursor.block_number
      );
    }

    if (cursor.index !== undefined) {
      params.set(
        "index",
        cursor.index
      );
    }

    if (cursor.items_count !== undefined) {
      params.set(
        "items_count",
        cursor.items_count
      );
    }

    url += `?${params.toString()}`;
  }

  return fetchJson(url);
}


// --------------------------------------------------
// CHECK TRADE LOG
// --------------------------------------------------

function isTradeLog(log) {

  const topics =
    log?.topics || [];

  return (
    topics.length > 0 &&
    String(topics[0]).toLowerCase() ===
      TRADE_TOPIC.toLowerCase()
  );
}


// --------------------------------------------------
// GET TOKEN TRANSFERS FROM TRANSACTION
// --------------------------------------------------

async function getTokenTransfers(txHash) {

  const url =
    `${BLOCKSCOUT_API}/transactions/${txHash}/token-transfers?type=ERC-20`;

  try {

    const data =
      await fetchJson(url);

    return data?.items || [];

  } catch (error) {

    console.error(
      "Token transfer error:",
      txHash,
      error.message
    );

    return [];
  }
}


// --------------------------------------------------
// PROCESS TRADE TRANSACTIONS
// --------------------------------------------------

async function processTrades(
  logs,
  tokenMap
) {

  for (const log of logs) {

    if (!isTradeLog(log)) {
      continue;
    }

    const txHash =
      log?.transaction_hash;

    if (!txHash) {
      continue;
    }

    const transfers =
      await getTokenTransfers(txHash);


    /*
      A Sikka Trade transaction can contain
      several transfers.

      We use the ERC-20 token transfer address
      as the actual token contract.
    */

    for (const transfer of transfers) {

      const token =
        transfer?.token;

      if (!token) {
        continue;
      }

      const address =
        token?.address;

      if (!address) {
        continue;
      }


      const normalizedAddress =
        address.toLowerCase();


      /*
        Ignore the Sikka contract itself.
      */

      if (
        normalizedAddress ===
        SIКKA_CONTRACT.toLowerCase()
      ) {
        continue;
      }


      if (!tokenMap.has(normalizedAddress)) {

        tokenMap.set(
          normalizedAddress,
          {
            address: address,

            name:
              token?.name ||
              "Unknown Token",

            symbol:
              token?.symbol ||
              "—",

            decimals:
              token?.decimals ??
              18,

            logo:
              token?.icon_url ||
              "",

            exchange_rate:
              token?.exchange_rate ??
              null,

            holders:
              token?.holders ??
              null,

            total_supply:
              token?.total_supply ??
              null,

            volume_24h:
              token?.volume_24h ??
              null,

            tradeCount: 0
          }
        );

      }


      const current =
        tokenMap.get(
          normalizedAddress
        );

      current.tradeCount += 1;

    }

  }

}


// --------------------------------------------------
// API HANDLER
// --------------------------------------------------

export default async function handler(
  req,
  res
) {

  try {

    const requestedLimit =
      Number(req.query?.limit || PAGE_SIZE);

    const limit =
      Math.min(
        Math.max(requestedLimit, 1),
        PAGE_SIZE
      );


    const cursor =
      decodeCursor(
        req.query?.cursor
      );


    const tokenMap =
      new Map();


    let currentCursor =
      cursor;

    let pagesRead = 0;

    let hasMoreLogs = true;


    /*
      Read several pages of Sikka logs
      until we have enough unique tokens.
    */

    while (
      pagesRead < MAX_LOG_PAGES &&
      hasMoreLogs &&
      tokenMap.size < limit
    ) {

      const data =
        await getSikkaLogs(
          currentCursor
        );

      pagesRead++;


      const logs =
        data?.items || [];


      if (!logs.length) {
        break;
      }


      await processTrades(
        logs,
        tokenMap
      );


      const next =
        data?.next_page_params;


      if (!next) {

        hasMoreLogs = false;
        currentCursor = null;

      } else {

        currentCursor = next;

      }

    }


    const allTokens =
      Array.from(
        tokenMap.values()
      );


    /*
      Return only requested number.
    */

    const items =
      allTokens.slice(
        0,
        limit
      );


    const hasMore =
      hasMoreLogs &&
      allTokens.length >= limit;


    const nextCursor =
      hasMore &&
      currentCursor
        ? encodeCursor(
            currentCursor
          )
        : null;


    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    res.setHeader(
      "Expires",
      "0"
    );


    return res.status(200).json({

      success: true,

      items,

      count:
        items.length,

      hasMore,

      nextCursor,

      pagesRead,

      source:
        "Sikka Trade + Blockscout"

    });


  } catch (error) {

    console.error(
      "Tokens API error:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to load tokens"

    });

  }

}
