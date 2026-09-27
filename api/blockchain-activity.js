const EXPLORER = "https://explorer.shardeum.org";

const TARGET_TRANSACTIONS = 20;
const PAGE_SIZE = 50;
const MAX_PAGES = 5;
const TIMEOUT_MS = 12000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Explorer returned non-JSON response (HTTP ${response.status})`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Explorer HTTP ${response.status}: ${
          data?.message ||
          data?.error ||
          "request failed"
        }`
      );
    }

    return data;

  } finally {
    clearTimeout(timer);
  }
}


/* -----------------------------
   SAFE BIGINT
----------------------------- */

function toBigInt(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0n;
  }

  try {
    return BigInt(String(value));
  } catch {
    return 0n;
  }
}


/* -----------------------------
   WEI -> SHM
----------------------------- */

function formatShm(value) {

  const wei = toBigInt(value);

  const base = 1000000000000000000n;

  const whole = wei / base;

  const fraction = (wei % base)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");

  return fraction
    ? `${whole}.${fraction}`
    : `${whole}`;
}


/* -----------------------------
   TRANSACTION TYPE
----------------------------- */

function normalizeType(tx) {

  const types = Array.isArray(tx?.transaction_types)
    ? tx.transaction_types.map(x =>
        String(x).toLowerCase()
      )
    : [];

  if (
    types.some(x =>
      x.includes("coin_transfer") ||
      x.includes("coin transfer") ||
      x === "transfer"
    )
  ) {
    return "TRANSFER";
  }

  if (
    types.some(x =>
      x.includes("unstake")
    )
  ) {
    return "UNSTAKE";
  }

  if (
    types.some(x =>
      x.includes("stake")
    )
  ) {
    return "STAKE";
  }

  if (
    types.some(x =>
      x.includes("contract")
    )
  ) {
    return "CONTRACT";
  }

  if (
    tx?.method ||
    tx?.to?.is_contract === true
  ) {
    return "CONTRACT";
  }

  return "TRANSFER";
}


/* -----------------------------
   BLOCK NUMBER
----------------------------- */

function normalizeBlock(tx) {

  const candidates = [

    tx?.block,

    tx?.block_number,

    tx?.blockNumber,

    tx?.block_height,

    tx?.blockHeight

  ];

  for (const value of candidates) {

    const n = Number(value);

    if (
      Number.isFinite(n) &&
      n > 0
    ) {
      return n;
    }
  }

  return 0;
}


/* -----------------------------
   TIME
----------------------------- */

function normalizeTime(tx) {

  const value =
    tx?.timestamp ??
    tx?.time ??
    tx?.created_at;

  if (!value) {
    return null;
  }

  const parsed = Date.parse(
    String(value)
  );

  if (Number.isFinite(parsed)) {

    return new Date(parsed)
      .toISOString();
  }

  const n = Number(value);

  if (
    Number.isFinite(n) &&
    n > 0
  ) {

    return new Date(
      n < 100000000000
        ? n * 1000
        : n
    ).toISOString();
  }

  return null;
}


/* -----------------------------
   AMOUNT
----------------------------- */

function getAmountWei(tx) {

  if (tx?.value !== undefined) {
    return tx.value;
  }

  return "0";
}


/* -----------------------------
   GAS FEE
----------------------------- */

function getGasFeeWei(tx) {

  if (
    tx?.fee?.value !== undefined
  ) {
    return tx.fee.value;
  }

  if (
    tx?.gas_used !== undefined &&
    tx?.gas_price !== undefined
  ) {

    return (
      toBigInt(tx.gas_used) *
      toBigInt(tx.gas_price)
    );
  }

  if (
    tx?.gasUsed !== undefined &&
    tx?.gasPrice !== undefined
  ) {

    return (
      toBigInt(tx.gasUsed) *
      toBigInt(tx.gasPrice)
    );
  }

  return "0";
}


/* -----------------------------
   FETCH TRANSACTIONS
----------------------------- */

async function fetchTransactions() {

  let all = [];

  let nextParams = null;

  for (
    let page = 0;
    page < MAX_PAGES;
    page++
  ) {

    let url =
      `${EXPLORER}/api/v2/transactions` +
      `?limit=${PAGE_SIZE}` +
      `&_=${Date.now()}`;

    /*
     * Blockscout pagination.
     */
    if (nextParams) {

      for (
        const [key, value]
        of Object.entries(nextParams)
      ) {

        if (
          value !== null &&
          value !== undefined
        ) {

          url +=
            `&${encodeURIComponent(key)}` +
            `=${encodeURIComponent(value)}`;
        }
      }
    }

    const data =
      await fetchJson(url);

    const items =
      Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.transactions)
          ? data.transactions
          : [];

    all.push(...items);

    /*
     * Stop if enough transactions
     * were collected.
     */
    if (
      all.length >=
      TARGET_TRANSACTIONS * 3
    ) {
      break;
    }

    /*
     * Get next Blockscout page.
     */
    nextParams =
      data?.next_page_params ||
      null;

    if (!nextParams) {
      break;
    }
  }

  return all;
}


/* -----------------------------
   MAIN API
----------------------------- */

export default async function handler(req, res) {

  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  );

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  if (req.method !== "GET") {

    return res.status(405).json({

      success: false,

      error: "GET only"

    });
  }

  try {

    const source =
      await fetchTransactions();


    /*
     * Normalize everything first.
     */
    const normalized =
      source
        .map(tx => {

          const block =
            normalizeBlock(tx);

          const time =
            normalizeTime(tx);

          return {

            type:
              normalizeType(tx),

            block,

            time,

            amountShm:
              formatShm(
                getAmountWei(tx)
              ),

            gasFeeShm:
              formatShm(
                getGasFeeWei(tx)
              )

          };

        })
        /*
         * Only real blockchain
         * transactions.
         */
        .filter(tx =>
          tx.block > 0
        );


    /*
     * Latest transaction first.
     */
    normalized.sort(
      (a, b) => {

        const blockDiff =
          Number(b.block) -
          Number(a.block);

        if (blockDiff !== 0) {
          return blockDiff;
        }

        const ta =
          Date.parse(a.time || "") || 0;

        const tb =
          Date.parse(b.time || "") || 0;

        return tb - ta;
      }
    );


    /*
     * Remove duplicate
     * block + time + type
     * combinations.
     */
    const seen =
      new Set();

    const activities = [];

    for (const tx of normalized) {

      const key =
        `${tx.block}|${tx.time}|${tx.type}|${tx.amountShm}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      activities.push(tx);

      if (
        activities.length >=
        TARGET_TRANSACTIONS
      ) {
        break;
      }
    }


    const latestBlock =
      activities.length
        ? activities[0].block
        : null;


    return res.status(200).json({

      success: true,

      source:
        "Shardeum Explorer / Blockscout API v2",

      transactionsFound:
        activities.length,

      latestBlock,

      activities,

      updatedAt:
        new Date().toISOString()

    });


  } catch (error) {

    console.error(
      "blockchain-activity:",
      error
    );

    return res.status(502).json({

      success: false,

      error:
        error?.message ||
        "Unable to load Shardeum blockchain activity",

      source:
        `${EXPLORER}/api/v2/transactions`,

      updatedAt:
        new Date().toISOString()

    });
  }
}
