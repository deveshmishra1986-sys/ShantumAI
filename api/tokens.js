const SIKKA_CONTRACT =
    "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const TRADE_TOPIC =
    "0xf7dd8a134438de4c59401760e24ef5c6ccc9c74583b2b022085697f3021e59768";

const RPC =
    "https://api.shardeum.org";

const EXPLORER_API =
    "https://explorer.shardeum.org/api/v2";

const BLOCK_STEP = 5000;
const DEFAULT_LIMIT = 50;


// --------------------------------------
// JSON RPC
// --------------------------------------

async function rpc(method, params) {

    const response = await fetch(RPC, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            jsonrpc: "2.0",

            id: 1,

            method,

            params

        })

    });


    const data =
        await response.json();


    if (data.error) {

        throw new Error(
            data.error.message ||
            "RPC error"
        );

    }


    return data.result;

}


// --------------------------------------
// Get latest block
// --------------------------------------

async function getLatestBlock() {

    const result =
        await rpc(
            "eth_blockNumber",
            []
        );

    return parseInt(
        result,
        16
    );

}


// --------------------------------------
// Get Sikka Trade logs
// --------------------------------------

async function getTradeLogs(
    fromBlock,
    toBlock
) {

    return await rpc(

        "eth_getLogs",

        [

            {

                address:
                    SIKKA_CONTRACT,

                fromBlock:
                    "0x" +
                    fromBlock.toString(16),

                toBlock:
                    "0x" +
                    toBlock.toString(16),

                topics: [

                    TRADE_TOPIC

                ]

            }

        ]

    );

}


// --------------------------------------
// Extract token address
// --------------------------------------

function getTokenAddress(log) {

    if (
        !log.topics ||
        log.topics.length < 3
    ) {

        return null;

    }


    if (
        log.topics[0].toLowerCase() !==
        TRADE_TOPIC.toLowerCase()
    ) {

        return null;

    }


    return (

        "0x" +
        log.topics[2].slice(-40)

    ).toLowerCase();

}


// --------------------------------------
// Get token information
// --------------------------------------

async function getTokenInfo(address) {

    try {

        const response =
            await fetch(

                `${EXPLORER_API}/tokens/${address}`

            );


        if (!response.ok) {

            return {

                address,

                name:
                    "Unknown Token",

                symbol:
                    "-",

                logo:
                    "",

                exchange_rate:
                    null

            };

        }


        const data =
            await response.json();


        return {

            address,

            name:
                data.name ||
                "Unknown Token",

            symbol:
                data.symbol ||
                "-",

            logo:
                data.icon_url ||
                "",

            exchange_rate:
                data.exchange_rate ||
                null

        };

    } catch {

        return {

            address,

            name:
                "Unknown Token",

            symbol:
                "-",

            logo:
                "",

            exchange_rate:
                null

        };

    }

}


// --------------------------------------
// MAIN API
// --------------------------------------

export default async function handler(
    req,
    res
) {

    try {

        const requestedLimit =
            Number(
                req.query.limit ||
                DEFAULT_LIMIT
            );


        const limit =
            Math.min(
                Math.max(
                    requestedLimit,
                    1
                ),
                50
            );


        const latest =
            await getLatestBlock();


        // When loading more, frontend sends
        // the block where previous scan ended.

        let endBlock =
            req.query.beforeBlock
                ? Number(
                    req.query.beforeBlock
                )
                : latest;


        const tokens =
            new Map();


        let scannedFrom =
            endBlock;


        let scannedTo =
            endBlock;


        // ----------------------------------
        // Keep scanning backwards until
        // we find requested number of tokens
        // ----------------------------------

        while (
            tokens.size < limit &&
            endBlock > 0
        ) {

            const startBlock =
                Math.max(
                    0,
                    endBlock - BLOCK_STEP + 1
                );


            console.log(
                "Scanning blocks:",
                startBlock,
                "-",
                endBlock
            );


            const logs =
                await getTradeLogs(
                    startBlock,
                    endBlock
                );


            scannedFrom =
                startBlock;


            scannedTo =
                endBlock;


            // --------------------------------
            // Add unique tokens
            // --------------------------------

            for (
                const log of logs
            ) {

                const address =
                    getTokenAddress(
                        log
                    );


                if (!address)
                    continue;


                if (
                    !tokens.has(address)
                ) {

                    tokens.set(

                        address,

                        {

                            address,

                            tradeCount:
                                1

                        }

                    );

                } else {

                    tokens.get(
                        address
                    ).tradeCount++;

                }


                if (
                    tokens.size >=
                    limit
                ) {

                    break;

                }

            }


            // Move backwards

            endBlock =
                startBlock - 1;


            // Stop at genesis

            if (
                startBlock === 0
            ) {

                break;

            }

        }


        // ----------------------------------
        // Get token metadata
        // ----------------------------------

        const addresses =
            Array.from(
                tokens.values()
            );


        const result =
            await Promise.all(

                addresses.map(
                    async token => {

                        const info =
                            await getTokenInfo(
                                token.address
                            );


                        return {

                            ...info,

                            tradeCount:
                                token.tradeCount

                        };

                    }
                )

            );


        return res.status(200).json({

            items:
                result,

            total:
                result.length,

            nextBeforeBlock:
                endBlock,

            scannedFrom,

            scannedTo

        });


    } catch (error) {

        console.error(
            "TOKEN API ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Unable to load traded tokens",

            details:
                error.message

        });

    }

}
