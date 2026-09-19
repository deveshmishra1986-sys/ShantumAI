const state = {
    tokens: [],
    nextPageParams: null,
    loading: false
};

const grid = document.getElementById("grid");
const status = document.getElementById("status");
const searchInput = document.getElementById("search");
const refreshButton = document.getElementById("refresh");
const moreButton = document.getElementById("more");

async function loadTokens(reset = false) {

    if (state.loading) return;

    state.loading = true;

    if (reset) {
        state.tokens = [];
        state.nextPageParams = null;
        grid.innerHTML = "";
        moreButton.hidden = true;
    }

    status.textContent = "Loading tokens...";

    try {

        let url = "/api/tokens";

        // Load next page using Blockscout cursor
        if (state.nextPageParams) {

            const params = new URLSearchParams();

            Object.entries(state.nextPageParams).forEach(
                ([key, value]) => {

                    if (
                        value !== undefined &&
                        value !== null &&
                        value !== ""
                    ) {
                        params.append(key, value);
                    }

                }
            );

            url += "?" + params.toString();
        }

        console.log("Requesting:", url);

        const response = await fetch(url);

        const data = await response.json();

        console.log("API response:", data);

        if (!response.ok) {

            throw new Error(
                data.details ||
                data.error ||
                `HTTP ${response.status}`
            );

        }

        const newTokens = data.items || [];

     const combined = [
    ...state.tokens,
    ...newTokens
];

// Remove duplicate contract addresses
const unique = new Map();

combined.forEach(token => {

    const address = (
        token.address_hash ||
        token.address ||
        ""
    ).toLowerCase();

    if (address) {
        unique.set(address, token);
    }

});

state.tokens = Array.from(unique.values());
        // IMPORTANT: save next page cursor
        state.nextPageParams =
            data.next_page_params || null;

        renderTokens();

        status.textContent =
            `Showing ${state.tokens.length} loaded tokens`;

        // Show Load More only when another page exists
        moreButton.hidden =
            !state.nextPageParams;

    } catch (error) {

        console.error(
            "Token loading error:",
            error
        );

        status.textContent =
            "Could not load tokens: " +
            error.message;

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

            const name =
                (token.name || "")
                    .toLowerCase();

            const symbol =
                (token.symbol || "")
                    .toLowerCase();

            const address =
                (
                    token.address_hash ||
                    token.address ||
                    ""
                ).toLowerCase();

            return (
                name.includes(search) ||
                symbol.includes(search) ||
                address.includes(search)
            );

        });

    grid.innerHTML = "";

    if (filtered.length === 0) {

        grid.innerHTML =
            `<div class="empty">
                No tokens found.
             </div>`;

        return;
    }

    filtered.forEach(token => {

        const address =
            token.address_hash ||
            token.address ||
            "";

        const name =
            token.name ||
            "Unknown Token";

        const symbol =
            token.symbol ||
            "-";

        const logo =
            token.icon_url ||
            token.logo ||
            "";

        const price =
            token.exchange_rate
                ? "$" + token.exchange_rate
                : "Price unavailable";

        const explorerUrl =
            `https://explorer.shardeum.org/token/${address}`;

        const card =
            document.createElement("article");

        card.className = "card";

        let logoHTML;

        if (logo) {

            logoHTML =
                `<img
                    class="logo"
                    src="${escapeHtml(logo)}"
                    alt="${escapeHtml(symbol)}"
                    onerror="this.style.display='none'"
                >`;

        } else {

            logoHTML =
                `<div class="logo placeholder">
                    ${escapeHtml(
                        symbol.charAt(0).toUpperCase()
                    )}
                </div>`;

        }

        card.innerHTML = `

            <div class="token-top">

                ${logoHTML}

                <div>

                    <h2>
                        ${escapeHtml(name)}
                    </h2>

                    <div class="symbol">
                        ${escapeHtml(symbol)}
                    </div>

                </div>

            </div>

            <div class="price">
                ${escapeHtml(price)}
            </div>

            <div class="address">
                ${shortAddress(address)}
            </div>

            <a
                href="${explorerUrl}"
                target="_blank"
                rel="noopener noreferrer"
            >
                View on explorer ↗
            </a>

        `;

        grid.appendChild(card);

    });
}


function shortAddress(address) {

    if (!address) return "";

    if (address.length < 20) {
        return address;
    }

    return (
        address.substring(0, 10) +
        "..." +
        address.substring(address.length - 6)
    );
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


searchInput.addEventListener(
    "input",
    renderTokens
);

refreshButton.addEventListener(
    "click",
    () => loadTokens(true)
);

moreButton.addEventListener(
    "click",
    () => loadTokens(false)
);


// Start
loadTokens(true);
