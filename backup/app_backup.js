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
      throw new Error(data.error || "Unable to load tokens");
    }

    const existing = new Set(
      state.tokens.map(token =>
        token.address.toLowerCase()
      )
    );

    for (const token of data.items || []) {
      const address = token.address.toLowerCase();

      if (!existing.has(address)) {
        state.tokens.push(token);
        existing.add(address);
      }
    }

    state.cursor = data.nextCursor || null;

    renderTokens();

    status.textContent =
      `${state.tokens.length} tokens loaded`;

    moreButton.hidden = !data.hasMore;

  } catch (error) {
    console.error(error);
    status.textContent = `Error: ${error.message}`;
  } finally {
    state.loading = false;
  }
}

function renderTokens() {
  const search =
    searchInput.value.trim().toLowerCase();

  const filtered = state.tokens.filter(token => {
    return (
      (token.name || "").toLowerCase().includes(search) ||
      (token.symbol || "").toLowerCase().includes(search) ||
      (token.address || "").toLowerCase().includes(search)
    );
  });

  grid.innerHTML = "";

  /* Force the grid layout */
  grid.style.display = "grid";
  grid.style.gridTemplateColumns =
    "repeat(4, minmax(0, 1fr))";
  grid.style.gap = "22px";
  grid.style.width = "100%";

  for (const token of filtered) {

    const card = document.createElement("div");

    /*
     * INLINE STYLES
     * This bypasses any CSS conflict.
     */
    card.style.cssText = `
      width: 100%;
      min-width: 0;
      min-height: 300px;
      padding: 22px;
      background: #11182c;
      border: 1px solid #293653;
      border-radius: 18px;
      overflow: hidden;
      color: #ffffff;
      box-sizing: border-box;
      box-shadow: 0 5px 20px rgba(0,0,0,0.25);
      font-family: Arial, Helvetica, sans-serif;
    `;

    const logoContainer =
      document.createElement("div");

    logoContainer.style.cssText = `
      width: 54px;
      height: 54px;
      margin-bottom: 18px;
    `;

    if (token.logo) {

      const img = document.createElement("img");

      img.src = token.logo;
      img.alt = token.symbol || "Token";

      img.style.cssText = `
        width: 54px;
        height: 54px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
      `;

      logoContainer.appendChild(img);

    } else {

      logoContainer.style.cssText += `
        border-radius: 50%;
        background: #6746f5;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
        font-weight: bold;
      `;

      logoContainer.textContent =
        (token.symbol || "?")
          .charAt(0)
          .toUpperCase();
    }

    card.appendChild(logoContainer);

    /* Name */

    const name = document.createElement("div");

    name.textContent =
      token.name || "Unknown Token";

    name.style.cssText = `
      font-size: 19px;
      font-weight: 700;
      line-height: 1.35;
      margin-bottom: 7px;
      word-break: break-word;
    `;

    card.appendChild(name);

    /* Symbol */

    const symbol = document.createElement("div");

    symbol.textContent =
      token.symbol || "?";

    symbol.style.cssText = `
      color: #929db8;
      font-size: 14px;
      margin-bottom: 22px;
    `;

    card.appendChild(symbol);

    /* Price */

    const price = document.createElement("div");

    price.textContent =
      token.exchange_rate !== null &&
      token.exchange_rate !== undefined
        ? `Price: $${token.exchange_rate}`
        : "Price: N/A";

    price.style.cssText = `
      font-size: 17px;
      margin-bottom: 12px;
    `;

    card.appendChild(price);

    /* Holders */

    const holders = document.createElement("div");

    holders.textContent =
      `Holders: ${token.holders ?? "N/A"}`;

    holders.style.cssText = `
      color: #b9c2d6;
      font-size: 14px;
      margin-bottom: 7px;
    `;

    card.appendChild(holders);

    /* Trades */

    const trades = document.createElement("div");

    trades.textContent =
      `Sikka Trades: ${token.tradeCount ?? 0}`;

    trades.style.cssText = `
      color: #b9c2d6;
      font-size: 14px;
      margin-bottom: 15px;
    `;

    card.appendChild(trades);

    /* Address */

    const address = document.createElement("div");

    address.textContent =
      token.address;

    address.title =
      token.address;

    address.style.cssText = `
      border-top: 1px solid #293653;
      padding-top: 12px;
      color: #7f8aa5;
      font-size: 11px;
      line-height: 1.5;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
      box-sizing: border-box;
    `;

    card.appendChild(address);

    grid.appendChild(card);
  }
}

/* Search */

searchInput.addEventListener(
  "input",
  renderTokens
);

/* Refresh */

refreshButton.addEventListener(
  "click",
  () => loadTokens(true)
);

/* Load More */

moreButton.addEventListener(
  "click",
  () => loadTokens(false)
);

/* Initial load */

loadTokens(true);