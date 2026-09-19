const EXPLORER_API = "https://explorer.shardeum.org/api/v2";

const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa".toLowerCase();

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const PAGE_SIZE = 15;
const MAX_LOG_PAGES = 5;

async function getJson(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Explorer request failed: ${response.status}`
    );
  }

  return response.json();
}

function encodeCursor(cursor) {
  if (!cursor) return "";

  return Buffer.from(
    JSON.stringify(cursor)
  ).toString("base64url");
}

function decodeCursor(value) {
  if (!value) return null;

  try {
    return JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    );
  } catch {
    return null;
  }
}

async function getSikkaLogs(cursor) {
  let url =
    `${EXPLORER_API}/addresses/${SIKKA_CONTRACT}/logs`;

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

function isTradeLog(log) {
  return (
    Array.isArray(log.topics) &&
    String(log.topics[0]).toLowerCase() ===
      TRADE_TOPIC.toLowerCase()
  );
}

async function getTokenTransfers(txHash) {
  const url =
    `${EXPLORER_API}/transactions/${txHash}/token-transfers?type=ERC-20`;

  return getJson(url);
}

function getTokenFromTransfer(transfer) {
  const token = transfer?.token;

  if (!token?.address) {
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
    exchange_rate: token.exchange_rate ?? null,
    holders: token.holders ?? null,
    total_supply: token.total_supply ?? null,
    volume_24h: token.volume_24h ?? null
  };
}

async function processTrades(logs, tokenMap) {
  const transactions = new Map();

  for (const log of logs) {
    if (!isTradeLog(log)) continue;

    const txHash =
      log.transaction_hash ||
      log.transactionHash ||
      log.tx_hash;

    if (txHash) {
      transactions.set(txHash, true);
    }
  }

  const txHashes = [...transactions.keys()];

  // Process 5 transactions at a time
  for (let i = 0; i < txHashes.length; i += 5) {
    const batch = txHashes.slice(i, i + 5);

    const results = await Promise.all(
      batch.map(async (txHash) => {
        try {
          const data = await getTokenTransfers(txHash);

          return {
            txHash,
            data
          };
        } catch (error) {
          console.error(
            "Token transfer error:",
            txHash,
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
      if (!result.data) continue;

      const transfers = Array.isArray(result.data)
        ? result.data
        : result.data.items || [];

      // Don't count the same token twice in one transaction
      const seenInTransaction = new Set();

      for (const transfer of transfers) {
        const token = getTokenFromTransfer(transfer);

        if (!token) continue;

        const address = token.address.toLowerCase();

        if (seenInTransaction.has(address)) {
          continue;
        }

        seenInTransaction.add(address);

        if (!tokenMap.has(address)) {
          tokenMap.set(address, {
            ...token,
            tradeCount: 1
          });
        } else {
          const existing = tokenMap.get(address);

          existing.tradeCount =
            Number(existing.tradeCount || 0) + 1;
        }
      }
    }
  }

  return txHashes.length;
}

export default async function handler(req, res) {
  // Completely disable caching
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

  try {
    const cursor = decodeCursor(
      req.query?.cursor
    );

    const tokenMap = new Map();

    let currentCursor = cursor;
    let nextCursor = null;
    let pagesRead = 0;

    let finished = false;

    while (
      tokenMap.size < PAGE_SIZE &&
      pagesRead < MAX_LOG_PAGES
    ) {
      pagesRead++;

      const data =
        await getSikkaLogs(currentCursor);

      const logs = Array.isArray(data)
        ? data
        : data.items || [];

      if (!logs.length) {
        finished = true;
        break;
      }

      await processTrades(
        logs,
        tokenMap
      );

      const explorerCursor =
        data.next_page_params;

      if (!explorerCursor) {
        finished = true;
        break;
      }

      currentCursor = explorerCursor;

      /*
       * If we have enough tokens for this page,
       * save the cursor for Load More.
       */
      if (tokenMap.size >= PAGE_SIZE) {
        nextCursor = explorerCursor;
        break;
      }
    }

    const items =
      [...tokenMap.values()]
        .slice(0, PAGE_SIZE);

    /*
     * If we reached the end, there is no Load More.
     */
    if (finished) {
      nextCursor = null;
    }

    res.status(200).json({
      success: true,
      items,
      count: items.length,
      hasMore: !!nextCursor,
      nextCursor: nextCursor
        ? encodeCursor(nextCursor)
        : null,
      pagesRead,
      source: "Sikka Trade + Blockscout"
    });

  } catch (error) {
    console.error(
      "Tokens API error:",
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}