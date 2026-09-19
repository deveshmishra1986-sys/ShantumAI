const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const BLOCKSCOUT_API =
  "https://explorer.shardeum.org/api/v2";

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f";

const PAGE_SIZE = 15;

async function getJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} from ${url}`
    );
  }

  return await response.json();
}

async function getSikkaLogs(cursor) {
  let url =
    `${BLOCKSCOUT_API}/addresses/${SIKKA_CONTRACT}/logs`;

  if (cursor) {
    url +=
      `?block_number=${encodeURIComponent(cursor.block_number)}` +
      `&index=${encodeURIComponent(cursor.index)}` +
      `&items_count=${encodeURIComponent(cursor.items_count)}`;
  }

  return await getJson(url);
}

function isTradeLog(log) {
  return (
    Array.isArray(log.topics) &&
    log.topics.length > 0 &&
    String(log.topics[0]).toLowerCase() ===
      TRADE_TOPIC.toLowerCase()
  );
}

async function getTokenTransfers(txHash) {
  const url =
    `${BLOCKSCOUT_API}/transactions/${txHash}/token-transfers?type=ERC-20`;

  try {
    const data = await getJson(url);
    return data.items || [];
  } catch (error) {
    console.error(
      "Transfer error:",
      txHash,
      error.message
    );

    return [];
  }
}

async function processLogs(logs, tokenMap) {
  for (const log of logs) {
    if (!isTradeLog(log)) {
      continue;
    }

    const txHash = log.transaction_hash;

    if (!txHash) {
      continue;
    }

    const transfers =
      await getTokenTransfers(txHash);

    for (const transfer of transfers) {
      const token = transfer.token;

      if (!token || !token.address) {
        continue;
      }

      const address =
        token.address;

      const key =
        address.toLowerCase();

      // Don't treat Sikka itself as a token
      if (
        key ===
        SIKKA_CONTRACT.toLowerCase()
      ) {
        continue;
      }

      if (!tokenMap.has(key)) {
        tokenMap.set(key, {
          address: address,
          name: token.name || "Unknown Token",
          symbol: token.symbol || "—",
          decimals: token.decimals ?? 18,
          logo: token.icon_url || "",
          holders: token.holders ?? null,
          total_supply: token.total_supply ?? null,
          exchange_rate: token.exchange_rate ?? null,
          volume_24h: token.volume_24h ?? null,
          tradeCount: 0
        });
      }

      const item =
        tokenMap.get(key);

      item.tradeCount += 1;
    }
  }
}

export default async function handler(req, res) {
  try {
    const requestedLimit =
      Number(req.query?.limit || 15);

    const limit =
      Math.min(
        Math.max(requestedLimit, 1),
        PAGE_SIZE
      );

    let cursor = null;

    if (req.query?.cursor) {
      try {
        cursor = JSON.parse(
          decodeURIComponent(
            req.query.cursor
          )
        );
      } catch {
        cursor = null;
      }
    }

    const tokenMap = new Map();

    let pagesRead = 0;
    let nextCursor = cursor;
    let hasMore = true;

    /*
      Read Sikka log pages until we have
      enough unique tokens.
    */

    while (
      tokenMap.size < limit &&
      pagesRead < 5 &&
      hasMore
    ) {
      const data =
        await getSikkaLogs(nextCursor);

      pagesRead++;

      const logs =
        data.items || [];

      await processLogs(
        logs,
        tokenMap
      );

      if (
        data.next_page_params
      ) {
        nextCursor =
          data.next_page_params;
      } else {
        hasMore = false;
        nextCursor = null;
      }

      if (!logs.length) {
        hasMore = false;
        nextCursor = null;
      }
    }

    const items =
      Array.from(
        tokenMap.values()
      ).slice(0, limit);

    let encodedNextCursor = null;

    if (
      hasMore &&
      nextCursor
    ) {
      encodedNextCursor =
        encodeURIComponent(
          JSON.stringify(
            nextCursor
          )
        );
    }

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    return res.status(200).json({
      success: true,
      items: items,
      count: items.length,
      hasMore: Boolean(
        hasMore &&
        encodedNextCursor
      ),
      nextCursor: encodedNextCursor,
      pagesRead: pagesRead,
      source: "Sikka Trade + Blockscout"
    });

  } catch (error) {

    console.error(
      "TOKENS API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
