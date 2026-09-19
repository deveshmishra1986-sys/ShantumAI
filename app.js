const state = {

    tokens: [],

    loading: false

};


const grid =
    document.getElementById("grid");

const status =
    document.getElementById("status");

const searchInput =
    document.getElementById("search");

const refreshButton =
    document.getElementById("refresh");

const moreButton =
    document.getElementById("more");


// ---------------------------------------
// LOAD TOKENS
// ---------------------------------------

async function loadTokens() {

    if (state.loading)
        return;


    state.loading = true;


    const search =
        searchInput.value.trim();


    status.textContent =
        search
            ? `Searching for "${search}"...`
            : "Loading Sikka traded tokens...";


    grid.innerHTML = "";


    try {

        let url =
            "/api/tokens";


        if (search) {

            url +=
                "?q=" +
                encodeURIComponent(search);

        }


        console.log(
            "Request:",
            url
        );


        const response =
            await fetch(url);


        const data =
            await response.json();


        console.log(
            "Response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.details ||
                data.error ||
                `HTTP ${response.status}`
            );

        }


        state.tokens =
            data.items || [];


        renderTokens();


        if (search) {

            status.textContent =
                `${state.tokens.length} token(s) found`;

        } else {

            status.textContent =
                `${state.tokens.length} Sikka traded token(s)`;

        }


    } catch (error) {

        console.error(error);


        status.textContent =
            "Could not load tokens: " +
            error.message;


    } finally {

        state.loading = false;

    }

}


// ---------------------------------------
// RENDER
// ---------------------------------------

function renderTokens() {

    grid.innerHTML = "";


    if (
        state.tokens.length === 0
    ) {

        grid.innerHTML =
            `
            <div class="empty">
                No traded tokens found.
            </div>
            `;

        return;

    }


    state.tokens.forEach(
        token => {

            const address =
                token.address || "";


            const name =
                token.name ||
                "Unknown Token";


            const symbol =
                token.symbol ||
                "-";


            const logo =
                token.logo ||
                "";


            const price =
                token.exchange_rate
                    ? "$" +
                      token.exchange_rate
                    : "Price unavailable";


            const explorerUrl =
                `https://explorer.shardeum.org/token/${address}`;


            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "card";


            let logoHTML;


            if (logo) {

                logoHTML =

                    `
                    <img
                        class="logo"
                        src="${escapeHtml(logo)}"
                        alt="${escapeHtml(symbol)}"
                        onerror="this.style.display='none'"
                    >
                    `;

            } else {

                logoHTML =

                    `
                    <div class="logo placeholder">
                        ${escapeHtml(
                            symbol
                                .charAt(0)
                                .toUpperCase()
                        )}
                    </div>
                    `;

            }


            card.innerHTML =

                `

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


                <div class="trade-info">

                    <span>
                        🟢 Buys:
                        ${token.buys || 0}
                    </span>

                    <span>
                        🔴 Sells:
                        ${token.sells || 0}
                    </span>

                    <span>
                        📊 Trades:
                        ${token.trades || 0}
                    </span>

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

        }
    );

}


// ---------------------------------------
// ADDRESS
// ---------------------------------------

function shortAddress(address) {

    if (!address)
        return "";


    if (address.length < 20)
        return address;


    return (

        address.substring(0, 10) +

        "..." +

        address.substring(
            address.length - 6
        )

    );

}


// ---------------------------------------
// HTML SECURITY
// ---------------------------------------

function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


// ---------------------------------------
// SEARCH
// ---------------------------------------

let searchTimer;


searchInput.addEventListener(
    "input",
    () => {

        clearTimeout(
            searchTimer
        );


        searchTimer =
            setTimeout(
                () => {

                    loadTokens();

                },
                500
            );

    }
);


// ---------------------------------------
// REFRESH
// ---------------------------------------

refreshButton.addEventListener(
    "click",
    () => {

        loadTokens();

    }
);


// ---------------------------------------
// LOAD MORE
// ---------------------------------------

// Not required anymore because
// the API builds the complete traded
// token list.

moreButton.hidden = true;


// ---------------------------------------
// START
// ---------------------------------------

loadTokens();
