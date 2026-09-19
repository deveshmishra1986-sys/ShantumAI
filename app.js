const state = {
    tokens: [],
    nextPageParams: null,
    loading: false
};

const tokenGrid = document.getElementById("tokenGrid");
const status = document.getElementById("status");
const searchInput = document.getElementById("search");
const refreshButton = document.getElementById("refresh");
const loadMoreButton = document.getElementById("loadMore");

async function loadTokens(reset = false) {

    if (state.loading) return;

    state.loading = true;

    if (reset) {
        state.tokens = [];
        state.nextPageParams = null;
        tokenGrid.innerHTML = "";
    }

    status.textContent = "Loading tokens...";

    try {

        let url = "/api/tokens";

        // Add pagination parameters returned by Blockscout
        if (state.nextPageParams) {

            const params = new URLSearchParams();

            Object.entries(state.nextPageParams).forEach(([key, value]) => {

                if (value !== null && value !== undefined) {
                    params.append(key, value);
                }

            });

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

        state.tokens = [
            ...state.tokens,
            ...newTokens
        ];

        state.nextPageParams =
            data.next_page_params || null;

        renderTokens();

        status.textContent =
            `Showing ${state.tokens.length} loaded tokens`;

        // Show/hide Load More
        if (state.nextPageParams) {
            loadMoreButton.style.display = "block";
        } else {
            loadMoreButton.style.display = "none";
        }

    } catch (error) {

        console.error("Token loading error:", error);

        status.textContent =
            "Could not load tokens: " + error.message;

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
                (token.name || "").toLowerCase();

            const symbol =
                (token.symbol || "").toLowerCase();

            const address =
                (token.address_hash || "").toLowerCase();

            return (
                name.includes(search) ||
                symbol.includes(search) ||
                address.includes(search)
            );

        });

    tokenGrid.innerHTML = "";

    filtered.forEach(token => {

        const card =
            document.createElement("div");

        card.className = "token-card";

        const logo =
            token.icon_url ||
            token.logo ||
            "";

        const image =
            logo
                ? `<img src="${logo}" alt="${token.symbol || "Token"}">`
                : `<div class="token-placeholder">
                       ${(token.symbol || "?")
                           .charAt(0)
                           .toUpperCase()}
                   </div>`;

        const address =
            token.address_hash ||
            token.address ||
            "";

        const explorerUrl =
            `https://explorer.shardeum.org/token/${address}`;

        card.innerHTML = `

            <div class="token-header">

                ${image}

                <div>

                    <h2>
                        ${escapeHtml(
                            token.name || "Unknown Token"
                        )}
                    </h2>

                    <span>
                        ${escapeHtml(
                            token.symbol || "-"
                        )}
                    </span>

                </div>

            </div>

            <div class="token-price">

                ${
                    token.exchange_rate
                        ? "$" + token.exchange_rate
                        : "Price unavailable"
                }

            </div>

            <div class="token-address">
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

        tokenGrid.appendChild(card);

    });
}


function shortAddress(address) {

    if (!address) return "";

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


loadMoreButton.addEventListener(
    "click",
    () => loadTokens(false)
);


// Initial load
loadTokens(true);
