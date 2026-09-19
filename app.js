const state = {
  tokens: [],
  cursor: null,
  loading: false,
  shmPriceUsd: null
};

const PAGE_SIZE = 15;

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const moreBtn = document.getElementById("more");
const searchInput = document.getElementById("search");
const refreshBtn = document.getElementById("refresh");


// --------------------------------------------------
// SHM PRICE
// --------------------------------------------------

async function loadShmPrice() {

  const priceElement =
    document.getElementById("shm-price");

  const updatedElement =
    document.getElementById("shm-updated");

  if (priceElement) {
    priceElement.textContent = "Loading...";
  }

  try {

    const response = await fetch(
      `/api/shm-price?_=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.error || "Unable to get SHM price"
      );
    }

    state.shmPriceUsd = Number(data.priceUsd);

    if (priceElement) {
      priceElement.textContent =
        formatUsd(state.shmPriceUsd);
    }

    if (updatedElement) {

      const date = new Date(data.checkedAt);

      updatedElement.textContent =
        `Updated: ${date.toLocaleTimeString()}`;
    }

    renderTokens();

  } catch (error) {

    console.error(
      "Failed to load SHM price:",
      error
    );

    if (priceElement) {
      priceElement.textContent = "Unavailable";
    }

    if (updatedElement) {
      updatedElement.textContent =
        "Unable to update";
    }
  }
}


// --------------------------------------------------
// FORMATTING
// --------------------------------------------------

function formatUsd(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  const n = Number(value);

  if (n === 0) {
    return "$0";
  }

  if (n < 0.000001) {
    return "$" + n.toExponential(6);
  }

  if (n < 0.01) {
    return "$" + n.toFixed(8);
  }

  if (n < 1) {
    return "$" + n.toFixed(6);
  }

  return "$" + n.toFixed(4);
}


function formatShm(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  const n = Number(value);

  if (n < 0.000001) {
    return n.toExponential(6);
  }

  if (n < 0.01) {
    return n.toFixed(8);
  }

  if (n < 1) {
    return n.toFixed(6);
  }

  return n.toFixed(4);
}


function formatNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "—";
  }

  return n.toLocaleString("en-US");
}


function shortenAddress(address) {

  if (!address) {
    return "—";
  }

  return (
    address.slice(0, 6) +
    "..." +
    address.slice(-4)
  );
}


function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// --------------------------------------------------
// EXPLORER
// --------------------------------------------------

function getExplorerUrl(address) {

  return (
    "https://explorer.shardeum.org/address/" +
    address
  );
}


// --------------------------------------------------
// LOGO
// --------------------------------------------------

function getLogo(token) {

  if (
    token.logo &&
    token.logo.trim() !== ""
  ) {
    return token.logo;
  }

  const symbol =
    token.symbol || "?";

  return (
    "https://ui-avatars.com/api/" +
    "?name=" +
    encodeURIComponent(symbol) +
    "&background=111827" +
    "&color=ffffff" +
    "&size=128" +
    "&bold=true"
  );
}


// --------------------------------------------------
// TOKEN USD PRICE
// --------------------------------------------------

function getTokenUsdPrice(token) {

  /*
    If API already provides USD price,
    use it.
  */

  if (
    token.priceUsd !== null &&
    token.priceUsd !== undefined
  ) {
    return Number(token.priceUsd);
  }

  /*
    If API provides Sikka price in SHM,
    calculate:

       Token SHM price
       ×
       SHM USD price
  */

  const priceShm =
    token.sikkaPriceShm ??
    token.priceShm ??
    token.price_shm ??
    null;

  if (
    priceShm !== null &&
    state.shmPriceUsd !== null
  ) {

    return (
      Number(priceShm) *
      Number(state.shmPriceUsd)
    );
  }

  return null;
}


// --------------------------------------------------
// TOKEN CARD
// --------------------------------------------------

function createCard(token) {

  const address =
    token.address || "";

  const name =
    token.name || "Unknown Token";

  const symbol =
    token.symbol || "—";

  const priceShm =
    token.sikkaPriceShm ??
    token.priceShm ??
    token.price_shm ??
    null;

  const priceUsd =
    getTokenUsdPrice(token);

  const explorerUrl =
    address
      ? getExplorerUrl(address)
      : "#";

  return `

    <div class="token-card">

      <div class="token-top">

        <img
          class="token-logo"
          src="${escapeHtml(getLogo(token))}"
          alt="${escapeHtml(symbol)}"
          onerror="this.style.display='none';"
        >

        <div class="token-title">

          <h3>
            ${escapeHtml(name)}
          </h3>

          <span>
            ${escapeHtml(symbol)}
          </span>

        </div>

      </div>


      <div class="token-price">

        <div class="price-row">

          <span>
            Price
          </span>

          <strong>

            ${
              priceShm !== null
                ? formatShm(priceShm) + " SHM"
                : "—"
            }

          </strong>

        </div>


        <div class="price-row">

          <span>
            USD
          </span>

          <strong>

            ${
              priceUsd !== null
                ? formatUsd(priceUsd)
                : "—"
            }

          </strong>

        </div>

      </div>


      <div class="token-info">

        <div>

          <span>
            Holders
          </span>

          <strong>
            ${formatNumber(token.holders)}
          </strong>

        </div>


        <div>

          <span>
            Sikka Trades
          </span>

          <strong>
            ${formatNumber(token.tradeCount)}
          </strong>

        </div>

      </div>


      <div class="token-address">

        <span>
          Contract
        </span>

        <a
          href="${explorerUrl}"
          target="_blank"
          rel="noopener noreferrer"
          title="${escapeHtml(address)}"
        >

          ${escapeHtml(
            shortenAddress(address)
          )}

          ↗

        </a>

      </div>

    </div>
  `;
}


// --------------------------------------------------
// RENDER
// --------------------------------------------------

function renderTokens() {

  const query =
    searchInput.value
      .trim()
      .toLowerCase();

  let tokens =
    state.tokens;

  if (query) {

    tokens =
      tokens.filter(token => {

        return (

          String(
            token.name || ""
          )
            .toLowerCase()
            .includes(query)

          ||

          String(
            token.symbol || ""
          )
            .toLowerCase()
            .includes(query)

          ||

          String(
            token.address || ""
          )
            .toLowerCase()
            .includes(query)

        );

      });

  }


  if (!tokens.length) {

    grid.innerHTML = `
      <div class="empty">
        No tokens found.
      </div>
    `;

    return;
  }


  grid.innerHTML =
    tokens
      .map(createCard)
      .join("");
}


// --------------------------------------------------
// LOAD TOKENS
// --------------------------------------------------

async function loadTokens(reset = false) {

  if (state.loading) {
    return;
  }

  state.loading = true;


  if (reset) {

    state.tokens = [];
    state.cursor = null;

    grid.innerHTML = "";

    statusEl.textContent =
      "Loading tokens...";
  }

  else {

    statusEl.textContent =
      "Loading more tokens...";
  }


  try {

    let url =
      `/api/tokens?limit=${PAGE_SIZE}&_=${Date.now()}`;


    if (state.cursor) {

      url +=
        `&cursor=${encodeURIComponent(
          state.cursor
        )}`;

    }


    const response =
      await fetch(url, {
        cache: "no-store"
      });


    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    if (!data.success) {

      throw new Error(
        data.error ||
        "API returned an error"
      );

    }


    if (reset) {

      state.tokens =
        data.items || [];

    }

    else {

      state.tokens = [
        ...state.tokens,
        ...(data.items || [])
      ];

    }


    state.cursor =
      data.nextCursor || null;


    renderTokens();


    statusEl.textContent =
      `${state.tokens.length} tokens loaded`;


    moreBtn.hidden =
      !data.hasMore;


  } catch (error) {

    console.error(error);

    statusEl.textContent =
      "Unable to load tokens.";

    if (!state.tokens.length) {

      grid.innerHTML = `
        <div class="empty">
          Failed to load tokens.<br>
          Please try Refresh.
        </div>
      `;

    }

  } finally {

    state.loading = false;

  }
}


// --------------------------------------------------
// EVENTS
// --------------------------------------------------

searchInput.addEventListener(
  "input",
  () => {
    renderTokens();
  }
);


refreshBtn.addEventListener(
  "click",
  async () => {

    await loadShmPrice();

    await loadTokens(true);

  }
);


moreBtn.addEventListener(
  "click",
  () => {
    loadTokens(false);
  }
);


// --------------------------------------------------
// START
// --------------------------------------------------

loadShmPrice();

loadTokens(true);


// Refresh SHM price every 60 seconds.
// CMC documents its latest quote cache/update
// frequency as approximately every 60 seconds.

setInterval(
  loadShmPrice,
  60 * 1000
);