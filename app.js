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
    let url =
      `/api/tokens?limit=15&_=${Date.now()}`;

    if (state.cursor) {
      url +=
        `&cursor=${encodeURIComponent(state.cursor)}`;
    }

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.error || "Unable to load tokens"
      );
    }

    const existing =
      new Set(
        state.tokens.map(
          token =>
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

  if (filtered.length === 0) {
    grid.innerHTML =
      `<div>No tokens found.</div>`;
    return;
  }

  for (const token of filtered) {
    const card =
      document.createElement("div");

    card.className = "token-card";

    const logo =
      token.logo
        ? `<img src="${token.logo}" alt="${token.symbol}">`
        : `<div class="token-placeholder">
             ${escapeHtml(
               (token.symbol || "?")
                 .charAt(0)
                 .toUpperCase()
             )}
           </div>`;

    const price =
      token.exchange_rate !== null &&
      token.exchange_rate !== undefined
        ? `$${token.exchange_rate}`
        : "N/A";

    card.innerHTML = `
      <div class="token-logo">
        ${logo}
      </div>

      <div class="token-info">
        <h3>
          ${escapeHtml(
            token.name || "Unknown"
          )}
        </h3>

        <div class="symbol">
          ${escapeHtml(
            token.symbol || "?"
          )}
        </div>

        <div class="price">
          Price: ${price}
        </div>

        <div class="holders">
          Holders:
          ${token.holders ?? "N/A"}
        </div>

        <div class="trades">
          Sikka Trades:
          ${token.tradeCount ?? 0}
        </div>

        <div class="address">
          ${token.address}
        </div>
      </div>
    `;

    grid.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

moreButton.addEventListener(
  "click",
  () => loadTokens(false)
);

refreshButton.addEventListener(
  "click",
  () => loadTokens(true)
);

searchInput.addEventListener(
  "input",
  () => renderTokens()
);

// Initial load
loadTokens(true);