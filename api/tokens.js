// api/tokens.js

const RPC_URL = "https://api.shardeum.org";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const SHANTUM_TX =
  "0x6d372e3d993ddb281c749811f0323b4da7e79a0e75ab81905c1c97aa2cd71f92";

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.result;
}

function decodeString(data) {
  if (!data || data === "0x") {
    return null;
  }

  try {
    const hex = data.slice(2);

    // Standard ABI string
    if (hex.length >= 128) {
      const offset = parseInt(hex.slice(0, 64), 16);

      const lengthPosition = offset * 2;

      const length = parseInt(
        hex.slice(
          lengthPosition,
          lengthPosition + 64
        ),
        16
      );

      const start = lengthPosition + 64;
      const end = start + length * 2;

      if (end <= hex.length) {
        return Buffer.from(
          hex.slice(start, end),
          "hex"
        )
          .toString("utf8")
          .replace(/\0/g, "")
          .trim();
      }
    }

    // bytes32
    return Buffer.from(
      hex.slice(0, 64),
      "hex"
    )
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();

  } catch (e) {
    return null;
  }
}

async function getMetadata(address) {
  const result = {
    address,
    name: null,
    symbol: null,
    decimals: null
  };

  try {
    const name = await rpc("eth_call", [
      {
        to: address,
        data: "0x06fdde03"
      },
      "latest"
    ]);

    result.name = decodeString(name);
  } catch (e) {
    result.nameError = e.message;
  }

  try {
    const symbol = await rpc("eth_call", [
      {
        to: address,
        data: "0x95d89b41"
      },
      "latest"
    ]);

    result.symbol = decodeString(symbol);
  } catch (e) {
    result.symbolError = e.message;
  }

  try {
    const decimals = await rpc("eth_call", [
      {
        to: address,
        data: "0x313ce567"
      },
      "latest"
    ]);

    if (decimals && decimals !== "0x") {
      result.decimals = parseInt(
        decimals,
        16
      );
    }
  } catch (e) {
    result.decimalsError = e.message;
  }

  return result;
}

module.exports = async function handler(req, res) {
  try {

    // ---------------------------------------------
    // 1. Get Shantum transaction receipt
    // ---------------------------------------------

    const receipt = await rpc(
      "eth_getTransactionReceipt",
      [SHANTUM_TX]
    );

    if (!receipt) {
      return res.status(404).json({
        error: "Transaction receipt not found"
      });
    }

    // ---------------------------------------------
    // 2. Find ERC20 Transfer logs
    // ---------------------------------------------

    const transfers = [];

    for (const log of receipt.logs || []) {

      if (
        log.topics &&
        log.topics[0] &&
        log.topics[0].toLowerCase() ===
          TRANSFER_TOPIC.toLowerCase()
      ) {

        transfers.push({
          tokenContract: log.address,
          from:
            "0x" +
            log.topics[1].slice(-40),
          to:
            "0x" +
            log.topics[2].slice(-40),
          value: log.data
        });
      }
    }

    // ---------------------------------------------
    // 3. Get unique token contracts
    // ---------------------------------------------

    const addresses = [
      ...new Set(
        transfers.map(x =>
          x.tokenContract.toLowerCase()
        )
      )
    ];

    // ---------------------------------------------
    // 4. Read metadata
    // ---------------------------------------------

    const tokens = [];

    for (const address of addresses) {
      const metadata =
        await getMetadata(address);

      tokens.push(metadata);
    }

    return res.status(200).json({
      transaction: SHANTUM_TX,

      receiptBlock: receipt.blockNumber,

      transferCount: transfers.length,

      transfers,

      tokenContracts: addresses,

      tokens
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
