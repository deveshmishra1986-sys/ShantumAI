const EXPLORER_API = "https://explorer.shardeum.org/api/v2";

const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa".toLowerCase();

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

// Number of Blockscout log pages to scan
const MAX_LOG_PAGES = 20;

async function getJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/*
 * Get Sikka contract logs.
 *
 * Blockscout uses:
 * block_number
 * index
 * items_count
 *
 * as pagination parameters.
 */
async function getSikkaLogs(cursor = null) {
  let url = `${EXPLORER_API}/addresses/${SIKKA_CONTRACT}/logs`;

  if (cursor) {
    const params = new URLSearchParams();

    if (cursor.block_number !== undefined) {
      params.set("block_number", cursor.block_number);
    }

    if (cursor.index !== undefined) {
      params.set("index", cursor.index);
    }

    if (cursor.items_count !== undefined) {
      params.set("items_count", cursor.items_count);
    }

    url += `?${params.toString()}`;
  }

  return getJson(url);
}

/*
 * Check whether a log is the Sikka Trade event.
 */
function isTradeLog(log) {
  if (!log || !Array.isArray(log.topics)) {
    return false;
  }

  return (
    String(log.topics[0]).toLowerCase() === TRADE_TOPIC.toLowerCase()
  );
}

/*
 * Get ERC20 token transfers for a transaction.
 */
async function getTokenTransfers(txHash) {
  const url =
    `${EXPLORER_API}/transactions/${txHash}/token-transfers?type=ERC-20`;

  return getJson(url);
}

/*
 * Convert Blockscout token information into our token object.
 */
function convertToken(transfer) {
  const token = transfer?.token;

  if (!token || !token.address) {
    return null;
  }

  return {
    address: token.address,
    name: token.name || "Unknown Token",
    symbol: token.symbol || "?",
    decimals:
      token.decimals !== undefined
        ? Number(token.decimals)
        : 18,

    logo: token.icon_url || "",

    exchange_rate:
      token.exchange_rate !== undefined
        ? token.exchange_rate
        : null,

    holders:
      token.holders !== undefined
        ? token.holders
        : null,

    total_supply:
      token.total_supply !== undefined
        ? token.total_supply
        : null,

    volume_24h:
      token.volume_24h !== undefined
        ? token.volume_24h
        : null
  };
}

/*
 * Process trade transactions and discover their actual ERC20 tokens.
 */
async function processTransactions(transactions, tokenMap) {
  const tradeTransactions = new Set();

  /*
   * Avoid processing the same transaction twice.
   */
  const uniqueTransactions = new Map();

  for (const log of transactions) {
    if (!isTradeLog(log)) {
      continue;
    }

    const txHash =
      log.transaction_hash ||
      log.transactionHash ||
      log.tx_hash;

    if (!txHash) {
      continue;
    }

    uniqueTransactions.set(txHash, log);
  }

  const txEntries = Array.from(uniqueTransactions.entries());

  /*
   * Process 5 transactions at a time.
   */
  const batchSize = 5;

  for (let i = 0; i < txEntries.length; i += batchSize) {
    const batch = txEntries.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async ([txHash]) => {
        try {
          const data = await getTokenTransfers(txHash);

          return {
            txHash,
            data
          };
        } catch (error) {
          console.error(
            `Token transfer error for ${txHash}:`,
            error.message
          );

          return {
            txHash,
            data: null
          };
        }
      })
    );

    for (const result of results) {
      if (!result.data) {
        continue;
      }

      const transfers = Array.isArray(result.data)
        ? result.data
        : result.data.items || [];

      /*
       * One trade transaction can contain multiple token
       * transfer records. Count each token only once per
       * transaction.
       */
      const tokensInThisTransaction = new Set();

      for (const transfer of transfers) {
        const token = convertToken(transfer);

        if (!token) {
          continue;
        }

        const address = token.address.toLowerCase();

        if (tokensInThisTransaction.has(address)) {
          continue;
        }

        tokensInThisTransaction.add(address);

        if (!tokenMap.has(address)) {
          tokenMap.set(address, {
            ...token,
            tradeCount: 1
          });
        } else {
          const existing = tokenMap.get(address);

          existing.tradeCount =
            Number(existing.tradeCount || 0) + 1;

          /*
           * Update metadata if newer data is available.
           */
          if (
            (!existing.name ||
              existing.name === "Unknown Token") &&
            token.name
          ) {
            existing.name = token.name;
          }

          if (
            (!existing.symbol || existing.symbol === "?") &&
            token.symbol
          ) {
            existing.symbol = token.symbol;
          }

          if (!existing.logo && token.logo) {
            existing.logo = token.logo;
          }

          if (
            existing.holders === null &&
            token.holders !== null
          ) {
            existing.holders = token.holders;
          }

          if (
            existing.exchange_rate === null &&
            token.exchange_rate !== null
          ) {
            existing.exchange_rate =
              token.exchange_rate;
          }
        }
      }

      tradeTransactions.add(result.txHash);
    }
  }

  return tradeTransactions.size;
}

export default async function handler(req, res) {
  try {
    let limit = Number(req.query?.limit || DEFAULT_LIMIT);

    if (!Number.isFinite(limit) || limit <= 0) {
      limit = DEFAULT_LIMIT;
    }

    limit = Math.min(limit, MAX_LIMIT);

    const tokenMap = new Map();

    let cursor = null;
    let pagesRead = 0;
    let totalTradeTransactions = 0;

    let hasMore = false;
    let nextCursor = null;

    while (
      pagesRead < MAX_LOG_PAGES &&
      tokenMap.size < limit
    ) {
      pagesRead++;

      console.log(
        `Reading Sikka logs page ${pagesRead}`
      );

      const data = await getSikkaLogs(cursor);

      const logs = Array.isArray(data)
        ? data
        : data.items || [];

      if (!logs.length) {
        hasMore = false;
        break;
      }

      const tradeCount = await processTransactions(
        logs,
        tokenMap
      );

      totalTradeTransactions += tradeCount;

      /*
       * Blockscout pagination.
       */
      const pageCursor = data.next_page_params;

      if (!pageCursor) {
        hasMore = false;
        break;
      }

      /*
       * If we already have enough tokens, save the cursor
       * so the frontend can request the next batch later.
       */
      if (tokenMap.size >= limit) {
        hasMore = true;
        nextCursor = pageCursor;
        break;
      }

      cursor = pageCursor;
      hasMore = true;
    }

    const items = Array.from(tokenMap.values())
      .slice(0, limit);

    res.status(200).json({
      success: true,

      items,

      total: items.length,

      tradeTransactions: totalTradeTransactions,

      pagesRead,

      hasMore,

      nextCursor,

      source: "Sikka Trade + Blockscout"
    });

  } catch (error) {
    console.error("Tokens API error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Unknown error"
    });
  }
}
