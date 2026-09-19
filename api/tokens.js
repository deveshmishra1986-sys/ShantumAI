const SIKKA_CONTRACT =
    "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const TRADE_TOPIC =
    "0x47d3fba33a3dd9289bb1b402a128cbea5870c35eb7e684fd999c9b02c612f3f1";

const RPC =
    "https://api.shardeum.org";

const EXPLORER_API =
    "https://explorer.shardeum.org/api/v2";

const BLOCK_STEP = 5000;

const DEFAULT_LIMIT = 50;


// ======================================
// Convert number to valid even-length HEX
// ======================================

function toEvenHex(number) {

    let hex =
        Number(number).toString(16);

    if (hex.length % 2 !== 0) {

        hex =
            "0" + hex;

    }

    return "0x" + hex;
}


// ======================================
// Shardeum RPC
// ======================================

async function rpc(method, params) {

    const response =
        await fetch(
            RPC,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    jsonrpc: "2.0",

                    id: 1,

                    method,

                    params

                })
            }
        );


    const data =
        await response.json();


    if (data.error) {

        throw new Error(
            data.error.message ||
            "Shardeum RPC error"
        );

    }


    return data.result;
}


// ======================================
// Get latest Shardeum block
// ======================================

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


// ======================================
// Get Sikka Trade events
// ======================================

async function getTradeLogs(
    fromBlock,
    toBlock
) {

    const filter = {

        address:
            SIKKA_CONTRACT,

        fromBlock:
            toEvenHex(fromBlock),

        toBlock:
            toEvenHex(toBlock),

        topics: [

            TRADE_TOPIC

        ]

    };


    console.log(
        "RPC filter:",
        JSON.stringify(filter)
    );


    return await rpc(
        "eth_getLogs",
        [
            filter
        ]
    );

}


// ======================================
// Get token address from Trade event
// ======================================

function getTokenAddress(log) {

    if (
        !log.topics ||
        log.topics.length < 3
    ) {

        return null;

    }


    // Make sure this is our Trade event

    if (
        log.topics[0].toLowerCase() !==
        TRADE_TOPIC.toLowerCase()
    ) {

        return null;

    }


    /*
        Trade event:

        Trade(
            address indexed trader,
            address indexed subject,
            bool isBuy,
            uint256 shareAmount,
            uint256 tokenAmount,
            uint256 supply
        )

        topics[0] = event signature
        topics[1] = trader
        topics[2] = subject/token
    */


    const subject =
        log.topics[2];


    if (!subject) {

        return null;

    }


    // Last 40 characters = 20-byte address

    return (
        "0x" +
        subject.slice(-40)
    ).toLowerCase();

}


// ======================================
// Get token metadata
// ======================================

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

    }
    catch (error) {

        console.log(
            "Metadata error:",
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

            exchange_rate:
                null

        };

    }

}


// ======================================
// MAIN API
// ======================================

export default async function handler(
    req,
    res
) {

    try {

        // --------------------------------
        // Number of tokens requested
        // --------------------------------

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


        // --------------------------------
        // Get latest block
        // --------------------------------

        const latest =
            await getLatestBlock();


        console.log(
            "Latest block:",
            latest
        );


        // --------------------------------
        // Determine where to start
        // --------------------------------

        let endBlock;


        if (
            req.query.beforeBlock
        ) {

            endBlock =
                Number(
                    req.query.beforeBlock
                );

        }
        else {

            endBlock =
                latest;

        }


        if (
            !Number.isFinite(endBlock) ||
            endBlock < 0
        ) {

            endBlock =
                latest;

        }


        // --------------------------------
        // Store unique tokens
        // --------------------------------

        const tokens =
            new Map();


        let scannedFrom =
            endBlock;


        let scannedTo =
            endBlock;


        // --------------------------------
        // Scan backwards
        // --------------------------------

        while (
            tokens.size < limit &&
            endBlock > 0
        ) {

            const startBlock =
                Math.max(
                    0,
                    endBlock -
                    BLOCK_STEP +
                    1
                );


            console.log(
                "Scanning blocks:",
                startBlock,
                "to",
                endBlock
            );


            const logs =
                await getTradeLogs(
                    startBlock,
                    endBlock
                );


            console.log(
                "Trade logs found:",
                logs.length
            );


            scannedFrom =
                startBlock;


            scannedTo =
                endBlock;


            // --------------------------------
            // Process trade events
            // --------------------------------

            for (
                const log of logs
            ) {

                const address =
                    getTokenAddress(
                        log
                    );


                if (!address) {

                    continue;

                }


                // We only care that
                // at least ONE trade happened.

                if (
                    !tokens.has(address)
                ) {

                    tokens.set(

                        address,

                        {

                            address,

                            tradeCount: 1

                        }

                    );

                }
                else {

                    tokens.get(
                        address
                    ).tradeCount++;

                }


                // We have enough unique tokens

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


            if (
                startBlock === 0
            ) {

                break;

            }

        }


        // ==================================
        // Get metadata
        // ==================================

        const tokenList =
            Array.from(
                tokens.values()
            );


        /*
            Get metadata in parallel.
            Maximum is 50 because limit is 50.
        */

        const result =
            await Promise.all(

                tokenList.map(
                    async token => {

                        const info =
                            await getTokenInfo(
                                token.address
                            );


                        return {

                            address:
                                info.address,

                            name:
                                info.name,

                            symbol:
                                info.symbol,

                            logo:
                                info.logo,

                            exchange_rate:
                                info.exchange_rate,

                            tradeCount:
                                token.tradeCount

                        };

                    }
                )

            );


        // ==================================
        // Return result
        // ==================================

        return res.status(200).json({

            items:
                result,

            total:
                result.length,

            nextBeforeBlock:
                endBlock,

            scannedFrom:
                scannedFrom,

            scannedTo:
                scannedTo

        });


    }
    catch (error) {

        console.error(
            "Sikka Token API ERROR:",
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
