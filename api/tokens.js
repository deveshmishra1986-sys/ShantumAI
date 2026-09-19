const SIKKA_CONTRACT =
    "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const TRADE_TOPIC =
    "0xf7dd8a134438de4c59401760e24ef5c6ccc9c74583b2b022085697f3021e59768";

const EXPLORER_API =
    "https://explorer.shardeum.org/api/v2";

async function getJson(url) {
    const response = await fetch(url);

    const text = await response.text();

    if (!response.ok) {
        throw new Error(
            `Explorer API ${response.status}: ${text}`
        );
    }

    return JSON.parse(text);
}


// Get ALL logs from Sikka contract
async function getSikkaTradeLogs() {

    let allLogs = [];
    let nextPage = null;

    // Safety limit so one Vercel request doesn't run forever.
    // We can increase this later if required.
    const MAX_PAGES = 100;

    for (let page = 0; page < MAX_PAGES; page++) {

        let url =
            `${EXPLORER_API}/addresses/${SIKKA_CONTRACT}/logs`;

        if (nextPage) {

            const params =
                new URLSearchParams();

            Object.entries(nextPage).forEach(
                ([key, value]) => {

                    if (
                        value !== undefined &&
                        value !== null &&
                        value !== ""
                    ) {
                        params.append(
                            key,
                            value
                        );
                    }

                }
            );

            url += "?" + params.toString();
        }

        console.log(
            "Loading Sikka logs:",
            url
        );

        const data =
            await getJson(url);

        const logs =
            data.items || [];

        allLogs.push(...logs);

        nextPage =
            data.next_page_params || null;

        if (!nextPage) {
            break;
        }
    }

    return allLogs;
}


// Extract subject/token + buy/sell from Trade event
function parseTrade(log) {

    const topics =
        log.topics || [];

    if (!topics.length) {
        return null;
    }

    // Topic 0 must be Trade(...)
    if (
        topics[0].toLowerCase() !==
        TRADE_TOPIC.toLowerCase()
    ) {
        return null;
    }

    // topics:
    //
    // topic[0] = Trade event signature
    // topic[1] = trader
    // topic[2] = subject/token
    //
    if (topics.length < 3) {
        return null;
    }

    const trader =
        "0x" +
        topics[1].slice(-40);

    const subject =
        "0x" +
        topics[2].slice(-40);

    // Data layout:
    //
    // word 0 = isBuy
    // word 1 = shareAmount
    // word 2 = tokenAmount
    // word 3 = supply

    const data =
        (log.data || "0x").slice(2);

    if (data.length < 64) {
        return null;
    }

    const isBuy =
        BigInt(
            "0x" +
            data.substring(0, 64)
        ) === 1n;

    return {

        token:
            subject.toLowerCase(),

        trader:
            trader.toLowerCase(),

        isBuy,

        transactionHash:
            log.transaction_hash,

        blockNumber:
            log.block_number

    };
}


// Get token metadata from Blockscout
async function getTokenMetadata(address) {

    try {

        const url =
            `${EXPLORER_API}/tokens/${address}`;

        const data =
            await getJson(url);

        return {

            address:
                data.address_hash ||
                address,

            name:
                data.name ||
                "Unknown Token",

            symbol:
                data.symbol ||
                "-",

            logo:
                data.icon_url ||
                data.logo_url ||
                data.logo ||
                "",

            exchangeRate:
                data.exchange_rate ||
                null

        };

    } catch (error) {

        console.log(
            "Metadata unavailable:",
            address,
            error.message
        );

        return {

            address,

            name:
                "Unknown Token",

            symbol:
                "-",

            logo:
                "",

            exchangeRate:
                null

        };
    }
}


export default async function handler(req, res) {

    try {

        const search =
            (
                req.query.q ||
                ""
            )
                .trim()
                .toLowerCase();


        // -----------------------------------
        // 1. Get Sikka Trade events
        // -----------------------------------

        const logs =
            await getSikkaTradeLogs();


        // -----------------------------------
        // 2. Extract BUY / SELL events
        // -----------------------------------

        const trades =
            logs
                .map(parseTrade)
                .filter(Boolean);


        console.log(
            "Trade events:",
            trades.length
        );


        // -----------------------------------
        // 3. Group by token
        // -----------------------------------

        const tokenMap =
            new Map();


        for (const trade of trades) {

            const token =
                trade.token;

            if (!tokenMap.has(token)) {

                tokenMap.set(
                    token,
                    {
                        address: token,

                        buys: 0,

                        sells: 0,

                        trades: 0
                    }
                );

            }


            const item =
                tokenMap.get(token);


            if (trade.isBuy) {

                item.buys++;

            } else {

                item.sells++;

            }


            item.trades++;

        }


        // -----------------------------------
        // 4. Only tokens with >= 1 trade
        // -----------------------------------

        let tradedTokens =
            Array.from(
                tokenMap.values()
            )
                .filter(
                    token =>
                        token.trades >= 1
                );


        // -----------------------------------
        // 5. Search
        // -----------------------------------

        if (search) {

            tradedTokens =
                tradedTokens.filter(
                    token =>
                        token.address
                            .toLowerCase()
                            .includes(search)
                );

        }


        // -----------------------------------
        // 6. Fetch token metadata
        // -----------------------------------

        const result = [];

        for (
            const token of tradedTokens
        ) {

            const metadata =
                await getTokenMetadata(
                    token.address
                );


            result.push({

                address:
                    token.address,

                name:
                    metadata.name,

                symbol:
                    metadata.symbol,

                logo:
                    metadata.logo,

                exchange_rate:
                    metadata.exchangeRate,

                buys:
                    token.buys,

                sells:
                    token.sells,

                trades:
                    token.trades

            });

        }


        // -----------------------------------
        // 7. Search name/symbol too
        // -----------------------------------

        let finalResult =
            result;


        if (search) {

            finalResult =
                result.filter(
                    token =>

                        token.address
                            .toLowerCase()
                            .includes(search)

                        ||

                        token.name
                            .toLowerCase()
                            .includes(search)

                        ||

                        token.symbol
                            .toLowerCase()
                            .includes(search)
                );

        }


        return res.status(200).json({

            items:
                finalResult,

            total:
                finalResult.length

        });


    } catch (error) {

        console.error(
            "Sikka token API error:",
            error
        );

        return res.status(500).json({

            error:
                "Unable to load Sikka traded tokens",

            details:
                error.message

        });

    }

}
