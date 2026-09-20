const SHANTUM_CONTRACT =
  "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

const SIKKA_CONTRACT =
  "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const BLOCKSCOUT_API =
  "https://explorer.shardeum.org/api/v2";

const TRADE_TOPIC =
  "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f";

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

async function getSikkaLogs() {
  const url =
    `${BLOCKSCOUT_API}/addresses/${SIKKA_CONTRACT}/logs`;

  return await getJson(url);
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

function isTradeLog(log) {
  return (
    Array.isArray(log.topics) &&
    log.topics.length > 0 &&
    String(log.topics[0]).toLowerCase() ===
      TRADE_TOPIC.toLowerCase()
  );
}

export default async function handler(req, res) {

  try {

    const data =
      await getSikkaLogs();

    const logs =
      data.items || [];

    const trades = [];

    for (const log of logs) {

      if (!isTradeLog(log)) {
        continue;
      }

      const txHash =
        log.transaction_hash;

      if (!txHash) {
        continue;
      }

      const transfers =
        await getTokenTransfers(txHash);

      const shantumTransfers =
        transfers.filter((transfer) => {

          const address =
            transfer.token?.address;

          return (
            address &&
            address.toLowerCase() ===
              SHANTUM_CONTRACT.toLowerCase()
          );

        });

      if (!shantumTransfers.length) {
        continue;
      }

      trades.push({

        transaction:
          txHash,

        block:
          log.block_number,

        timestamp:
          log.timestamp || null,

        shantumTransfers:
          shantumTransfers.map((transfer) => ({

            token:
              transfer.token?.symbol || "STM",

            name:
              transfer.token?.name || "Shantum",

            value:
              transfer.total?.value || null,

            decimals:
              transfer.token?.decimals ?? 18,

            from:
              transfer.from?.hash || null,

            to:
              transfer.to?.hash || null

          }))

      });

      /*
        We only need the latest
        Shantum-related trade for
        this first test.
      */

      if (trades.length >= 5) {
        break;
      }

    }

    return res.status(200).json({

      success: true,

      shantum:
        SHANTUM_CONTRACT,

      sikka:
        SIKKA_CONTRACT,

      tradeTopic:
        TRADE_TOPIC,

      tradeCount:
        trades.length,

      trades:
        trades,

      source:
        "Sikka Trade + Blockscout"

    });

  } catch (error) {

    console.error(
      "SHANTUM PRICE API ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

}
