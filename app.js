const state = {

    tokens: [],

    nextBeforeBlock: null,

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


// --------------------------------------
// LOAD TOKENS
// --------------------------------------

async function loadTokens(reset = false) {

    if (state.loading)
        return;


    state.loading = true;


    if (reset) {

        state.tokens = [];

        state.nextBeforeBlock = null;

        grid.innerHTML = "";

    }


    status.textContent =
        "Loading traded tokens...";


    try {

        let url =
            "/api/tokens?limit=50";


        if (
            state.nextBeforeBlock !== null
        ) {

            url +=
                "&beforeBlock=" +
                state.nextBeforeBlock;

        }


        console.log(
            "Loading:",
            url
        );


        const response =
            await fetch(url);


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.details ||
                data.error ||
                "API error"
            );

        }


        const newTokens =
            data.items || [];


        // --------------------------------
        // Remove duplicate addresses
        // --------------------------------

        const map =
            new Map();


        [
            ...state.tokens,
            ...newTokens
        ]
            .forEach(token => {

                map.set(
                    token.address.toLowerCase(),
                    token
                );

            });


        state.tokens =
            Array.from(
                map.values()
            );


        state.nextBeforeBlock =
            data.nextBeforeBlock;


        renderTokens();


        status.textContent =
            `Showing ${state.tokens.length} traded tokens`;


        // Hide Load More if no more data

        if (
            !newTokens.length ||
            data.nextBeforeBlock <= 0
        ) {

            moreButton.hidden =
                true;

        } else {

            moreButton.hidden =
                false;

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


// --------------------------------------
// RENDER
// --------------------------------------

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
                token.address;


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

                    📊 Trades:
                    ${token.tradeCount || 1}

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


// --------------------------------------
// SEARCH
// --------------------------------------

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

                    const text =
                        searchInput.value
                            .trim()
                            .toLowerCase();


                    if (!text) {

                        renderTokens();

                        return;

                    }


                    const filtered =
                        state.tokens.filter(
                            token =>

                                token.name
                                    .toLowerCase()
                                    .includes(text)

                                ||

                                token.symbol
                                    .toLowerCase()
                                    .includes(text)

                                ||

                                token.address
                                    .toLowerCase()
                                    .includes(text)

                        );


                    renderFiltered(
                        filtered
                    );

                },
                300
            );

    }
);


// --------------------------------------
// FILTERED RENDER
// --------------------------------------

function renderFiltered(tokens) {

    grid.innerHTML = "";


    if (!tokens.length) {

        grid.innerHTML =
            `
            <div class="empty">
                Token not found in loaded tokens.
            </div>
            `;

        return;

    }


    tokens.forEach(
        token => {

            const address =
                token.address;


            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "card";


            card.innerHTML =

                `

                <div class="token-top">

                    <div class="logo placeholder">

                        ${escapeHtml(
                            (
                                token.symbol ||
                                "?"
                            )
                                .charAt(0)
                                .toUpperCase()
                        )}

                    </div>

                    <div>

                        <h2>
                            ${escapeHtml(
                                token.name
                            )}
                        </h2>

                        <div class="symbol">
                            ${escapeHtml(
                                token.symbol
                            )}
                        </div>

                    </div>

                </div>


                <div class="trade-info">

                    📊 Trades:
                    ${token.tradeCount || 1}

                </div>


                <div class="address">

                    ${shortAddress(address)}

                </div>


                <a
                    href="https://explorer.shardeum.org/token/${address}"
                    target="_blank"
                >
                    View on explorer ↗
                </a>

                `;


            grid.appendChild(card);

        }
    );

}


// --------------------------------------
// REFRESH
// --------------------------------------

refreshButton.addEventListener(
    "click",
    () => {

        searchInput.value = "";

        loadTokens(true);

    }
);


// --------------------------------------
// LOAD MORE
// --------------------------------------

moreButton.addEventListener(
    "click",
    () => {

        loadTokens(false);

    }
);


// --------------------------------------
// HELPERS
// --------------------------------------

function shortAddress(address) {

    return (
        address.substring(0, 10) +
        "..." +
        address.substring(
            address.length - 6
        )
    );

}


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


// --------------------------------------
// START
// --------------------------------------

loadTokens(true);
