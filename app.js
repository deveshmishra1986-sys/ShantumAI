const state = {
  tokens: [],
  cursor: null,
  loading: false
};

const grid = document.getElementById("grid");
const status = document.getElementById("status");
const moreButton = document.getElementById("more");
const refreshButton = document.getElementById("refresh");
const searchInput = document.getElementById("search");

async function loadTokens(reset = false) {
  if (state.loading) return;

  state.loading = true;

  if (reset) {
    state.tokens = [];
    state.cursor = null;
    grid.innerHTML = "";
  }

  status.textContent =
    state.tokens.length === 0
      ? "Loading tokens..."
      : "Loading more tokens...";

  try {
    let url = `/api/tokens?limit=15&_=${Date.now()}`;

    if (state.cursor) {
      url += `&cursor=${encodeURIComponent(state.cursor)}`;
    }

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.error || "Unable to load tokens"
      );
    }

    const existing = new Set(
      state.tokens.map(token =>
        token.address.toLowerCase()
      )
    );

    for (const token of data.items || []) {
      const address =
        token.address.toLowerCase();

      if (!existing.has(address)) {
        state.tokens.push(token);
        existing.add(address);
      }
    }

    state.cursor =
      data.nextCursor || null;

    renderTokens();

    status.textContent =
      `${state.tokens.length} tokens loaded`;

    moreButton.hidden =
      !data.hasMore;

  } catch (error) {
    console.error(error);

    status.textContent =
      `Error: ${error.message}`;

  } finally {
    state.loading = false;
  }
}


function renderTokens() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();

  const filtered =
    state.tokens.filter(token => {

      return (
        (token.name || "")
          .toLowerCase()
          .includes(search) ||

        (token.symbol || "")
          .toLowerCase()
          .includes(search) ||

        (token.address || "")
          .toLowerCase()
          .includes(search)
      );
    });

  grid.innerHTML = "";

  for (const token of filtered) {

    /*
     * TOKEN CARD
     */
    const card =
      document.createElement("div");

    card.className =
      "token-card";


    /*
     * TOKEN LOGO
     */
    const logoContainer =
      document.createElement("div");

    logoContainer.className =
      "token-logo";


    if (token.logo) {

      const img =
        document.createElement("img");

      img.src = token.logo;

      img.alt =
        token.symbol || "Token";

      img.loading = "lazy";

      img.onerror = function () {

        this.style.display = "none";

        logoContainer.innerHTML =
          `<div class="token-placeholder">
             ${escapeHtml(
               (token.symbol || "?")
                 .charAt(0)
                 .toUpperCase()
             )}
           </div>`;
      };

      logoContainer.appendChild(img);

    } else {

      logoContainer.innerHTML =
        `<div class="token-placeholder">
          ${escapeHtml(
            (token.symbol || "?")
              .charAt(0)
              .toUpperCase()
          )}
        </div>`;
    }


    /*
     * TOKEN INFORMATION
     */
    const info =
      document.createElement("div");

    info.className =
      "token-info";


    /*
     * NAME
     */
    const name =
      document.createElement("h3");

    name.textContent =
      token.name || "Unknown Token";

    info.appendChild(name);


    /*
     * SYMBOL
     */
    const symbol =
      document.createElement("div");

    symbol.className =
      "symbol";

    symbol.textContent =
      token.symbol || "?";

    info.appendChild(symbol);


    /*
     * PRICE
     */
    const price =
      document.createElement("div");

    price.className =
      "price";

    if (
      token.exchange_rate !== null &&
      token.exchange_rate !== undefined &&
      token.exchange_rate !== ""
    ) {

      const numericPrice =
        Number(token.exchange_rate);

      if (
        Number.isFinite(numericPrice)
      ) {

        price.textContent =
          `Price: ${formatPrice(numericPrice)}`;

      } else {

        price.textContent =
          `Price: ${token.exchange_rate}`;

      }

    } else {

      price.textContent =
        "Price: N/A";
    }

    info.appendChild(price);


    /*
     * HOLDERS
     */
    const holders =
      document.createElement("div");

    holders.className =
      "holders";

    holders.textContent =
      `Holders: ${
        token.holders ?? "N/A"
      }`;

    info.appendChild(holders);


    /*
     * SIKKA TRADES
     */
    const trades =
      document.createElement("div");

    trades.className =
      "trades";

    trades.textContent =
      `Sikka Trades: ${
        token.tradeCount ?? 0
      }`;

    info.appendChild(trades);


    /*
     * CONTRACT ADDRESS
     */
    const address =
      document.createElement("div");

    address.className =
      "address";

    address.textContent =
      shortenAddress(token.address);

    address.title =
      token.address;

    info.appendChild(address);


    /*
     * ADD EVERYTHING TO CARD
     */
    card.appendChild(logoContainer);

    card.appendChild(info);

    grid.appendChild(card);
  }
}


/*
 * PRICE FORMAT
 */
function formatPrice(price) {

  if (price === 0) {
    return "$0";
  }

  if (price >= 1) {
    return `$${price.toLocaleString(
      undefined,
      {
        maximumFractionDigits: 6
      }
    )}`;
  }

  if (price >= 0.01) {
    return `$${price.toFixed(6)}`;
  }

  if (price >= 0.000001) {
    return `$${price.toFixed(8)}`;
  }

  return `$${price.toExponential(4)}`;
}


/*
 * SHORTEN CONTRACT ADDRESS
 */
function shortenAddress(address) {

  if (!address) {
    return "";
  }

  if (address.length <= 14) {
    return address;
  }

  return (
    address.substring(0, 6) +
    "..." +
    address.substring(
      address.length - 6
    )
  );
}


/*
 * HTML SAFETY
 */
function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/*
 * SEARCH
 */
searchInput.addEventListener(
  "input",
  renderTokens
);


/*
 * REFRESH
 */
refreshButton.addEventListener(
  "click",
  () => loadTokens(true)
);


/*
 * LOAD MORE
 */
moreButton.addEventListener(
  "click",
  () => loadTokens(false)
);


/*
 * INITIAL LOAD
 */
loadTokens(true);