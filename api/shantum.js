const SHANTUM_CONTRACT =
  "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

const SHARDEUM_RPC =
  "https://api.shardeum.org";

const MAX_SUPPLY = "1000000000";

async function rpcCall(method, params = []) {
  const response = await fetch(SHARDEUM_RPC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(
      `RPC HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      data.error.message || "RPC error"
    );
  }

  return data.result;
}


// --------------------------------------------------
// ERC-20 CALLS
// --------------------------------------------------

async function ethCall(data) {
  return await rpcCall("eth_call", [
    {
      to: SHANTUM_CONTRACT,
      data: data
    },
    "latest"
  ]);
}


// name()
async function getName() {
  const result = await ethCall(
    "0x06fdde03"
  );

  return decodeString(result);
}


// symbol()
async function getSymbol() {
  const result = await ethCall(
    "0x95d89b41"
  );

  return decodeString(result);
}


// decimals()
async function getDecimals() {
  const result = await ethCall(
    "0x313ce567"
  );

  return parseInt(result, 16);
}


// totalSupply()
async function getTotalSupply() {
  const result = await ethCall(
    "0x18160ddd"
  );

  const raw = BigInt(result);

  return raw;
}


// --------------------------------------------------
// ABI STRING DECODER
// --------------------------------------------------

function decodeString(hex) {

  if (!hex || hex === "0x") {
    return "";
  }

  const clean =
    hex.startsWith("0x")
      ? hex.slice(2)
      : hex;

  try {

    /*
      Standard ABI dynamic string:

      offset
      length
      string bytes
    */

    const offset =
      Number(
        BigInt(
          "0x" +
          clean.slice(0, 64)
        )
      );

    const length =
      Number(
        BigInt(
          "0x" +
          clean.slice(
            offset * 2,
            offset * 2 + 64
          )
        )
      );

    const stringHex =
      clean.slice(
        offset * 2 + 64,
        offset * 2 + 64 + length * 2
      );

    return Buffer.from(
      stringHex,
      "hex"
    ).toString("utf8");

  } catch {

    /*
      Some contracts return bytes32
      instead of a dynamic string.
    */

    try {

      return Buffer.from(
        clean.slice(0, 64),
        "hex"
      )
        .toString("utf8")
        .replace(/\0/g, "");

    } catch {

      return "";

    }
  }
}


// --------------------------------------------------
// FORMAT SUPPLY
// --------------------------------------------------

function formatSupply(raw, decimals) {

  const divisor =
    10n ** BigInt(decimals);

  const whole =
    raw / divisor;

  const fraction =
    raw % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionText =
    fraction
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");

  return `${whole}.${fractionText}`;
}


// --------------------------------------------------
// API
// --------------------------------------------------

export default async function handler(req, res) {

  try {

    const [
      name,
      symbol,
      decimals,
      rawSupply
    ] = await Promise.all([
      getName(),
      getSymbol(),
      getDecimals(),
      getTotalSupply()
    ]);

    const currentSupply =
      formatSupply(
        rawSupply,
        decimals
      );

    return res.status(200).json({

      success: true,

      name:
        name || "Shantum",

      symbol:
        symbol || "STM",

      contract:
        SHANTUM_CONTRACT,

      decimals:

        decimals,

      currentSupply:

        currentSupply,

      maxSupply:

        MAX_SUPPLY,

      maxSupplyFormatted:

        "1,000,000,000 STM",

      explorer:

        `https://explorer.shardeum.org/address/${SHANTUM_CONTRACT}`,

      checkedAt:
        new Date().toISOString(),

      source:
        "Shardeum JSON-RPC"

    });

  } catch (error) {

    console.error(
      "SHANTUM API ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error.message

    });

  }
}
