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
// HEX
// ======================================

function toEvenHex(number) {

    let hex =
        Number(number).toString(16);

    if (hex.length % 2 !== 0) {
        hex = "0" + hex;
    }

    return "0x" + hex;
}


// ======================================
// RPC
// ======================================

async function rpc(method, params) {

    const response =
        await fetch(RPC, {
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


// ======================================
// LATEST BLOCK
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
// SIKKA TRADE LOGS
// ======================================

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
                    toEvenHex(fromBlock),

                toBlock:
                    toEvenHex(toBlock),

                topics: [
                    TRADE_TOPIC
                ]
            }
        ]
    );

}


// ======================================
// TOKEN ADDRESS FROM TRADE
// ======================================

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


// ======================================
// DECODE ABI STRING
// ======================================

function decodeAbiString(hex) {

    if (
        !hex ||
        hex === "0x"
    ) {
        return "";
    }


    try {

        let data =
            hex.startsWith("0x")
                ? hex.substring(2)
                : hex;


        // -------------------------------
        // bytes32 format
        // -------------------------------

        if (data.length === 64) {

            return hexToString(
                data.replace(
                    /00+$/,
                    ""
                )
            );

        }


        // -------------------------------
        // Dynamic string
        // -------------------------------

        if (data.length >= 128) {

            const offset =
                parseInt(
                    data.substring(
                        0,
                        64
                    ),
                    16
                );


            const offsetHex =
                offset * 2;


            if (
                offsetHex + 64 <=
                data.length
            ) {

                const length =
                    parseInt(
                        data.substring(
                            offsetHex,
                            offsetHex + 64
                        ),
                        16
                    );


                const start =
                    offsetHex + 64;


                const end =
                    start +
                    length * 2;


                if (
                    end <= data.length
                ) {

                    return hexToString(
                        data.substring(
                            start,
                            end
                        )
                    );

                }

            }

        }


        // -------------------------------
        // Last fallback
        // -------------------------------

        return hexToString(
            data.replace(
                /00+$/,
                ""
            )
        );

    } catch (error) {

        console.log(
            "Decode error:",
            error.message
        );

        return "";

    }

}


// ======================================
// HEX → STRING
// ======================================

function hexToString(hex) {

    if (!hex) {
        return "";
    }


    try {

        const bytes = [];


        for (
            let i = 0;
            i < hex.length;
            i += 2
        ) {

            const byte =
                parseInt(
                    hex.substring(
                        i,
                        i + 2
                    ),
                    16
                );


            if (
                !Number.isNaN(byte) &&
                byte !== 0
            ) {

                bytes.push(byte);

            }

        }


        return new TextDecoder()
            .decode(
                new Uint8Array(bytes)
            )
            .trim();

    } catch {

        return "";

    }

}


// ======================================
// DIRECT ERC20 READ
// ======================================

async function readTokenFunction(
    address,
    selector
) {

    try {

        const result =
            await rpc(
                "eth_call",
                [
                    {
                        to: address,
                        data: selector
                    },
                    "latest"
                ]
            );


        if (
            !result ||
            result === "0x"
        ) {

            return "";

        }


        return decodeAbiString(
            result
        );

    } catch (error) {

        console.log(
            "eth_call failed:",
            address,
            selector,
            error.message
        );

        return "";

    }

}


// ======================================
// DECIMALS
// ======================================

async function readDecimals(
    address
) {

    try {

        const result =
            await rpc(
                "eth_call",
                [
                    {
                        to: address,
                        data: "0x313ce567"
                    },
                    "latest"
                ]
            );


        if (!result || result === "0x") {
            return null;
        }


        return parseInt(
            result,
            16
        );

    } catch {

        return null;

    }

}


// ======================================
// EXPLORER TOKEN DATA
// ======================================

async function getExplorerToken(
    address
) {

    try {

        const response =
            await fetch(
                `${EXPLORER_API}/tokens/${address}`
            );


        if (
            response.ok
        ) {

            const data =
                await response.json();


            return {

                name:
                    data.name || "",

                symbol:
                    data.symbol || "",

                logo:
                    data.icon_url ||
                    data.logo_url ||
                    "",

                exchange_rate:
                    data.exchange_rate ||
                    null

            };

        }

    } catch (error) {

        console.log(
            "Token API failed:",
            error.message
        );

    }


    return null;

}


// ======================================
// EXPLORER ADDRESS DATA
// ======================================

async function getExplorerAddress(
    address
) {

    try {

        const response =
            await fetch(
                `${EXPLORER_API}/addresses/${address}`
            );


        if (!response.ok) {
            return null;
        }


        const data =
            await response.json();


        if (
            data.token
        ) {

            return {

                name:
                    data.token.name ||
                    "",

                symbol:
                    data.token.symbol ||
                    "",

                logo:
                    data.token.icon_url ||
                    "",

                exchange_rate:
                    data.token.exchange_rate ||
                    null

            };

        }

    } catch (error) {

        console.log(
            "Address API failed:",
            error.message
        );

    }


    return null;

}


// ======================================
// COMPLETE TOKEN METADATA
// ======================================

async function getTokenMetadata(
    address
) {

    // First try Blockscout token API

    const tokenData =
        await getExplorerToken(
            address
        );


    if (
        tokenData &&
        (
            tokenData.name ||
            tokenData.symbol
        )
    ) {

        return tokenData;

    }


    // Then try address API

    const addressData =
        await getExplorerAddress(
            address
        );


    if (
        addressData &&
        (
            addressData.name ||
            addressData.symbol
        )
    ) {

        return addressData;

    }


    // Finally read contract directly

    const [
        name,
        symbol,
        decimals
    ] = await Promise.all([

        readTokenFunction(
            address,
            "0x06fdde03"
        ),

        readTokenFunction(
            address,
            "0x95d89b41"
        ),

        readDecimals(
            address
        )

    ]);


    return {

        name:
            name ||
            "Unknown Token",

        symbol:
            symbol ||
            "-",

        logo:
            tokenData?.logo ||
            addressData?.logo ||
            "",

        exchange_rate:
            tokenData?.exchange_rate ||
            addressData?.exchange_rate ||
            null,

        decimals

    };

}


// ======================================
// MAIN API
// ======================================

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


        // --------------------------------
        // Latest block
        // --------------------------------

        const latest =
            await getLatestBlock();


        // --------------------------------
        // Where to start
        // --------------------------------

        let endBlock =
            req.query.beforeBlock
                ? Number(
                    req.query.beforeBlock
                )
                : latest;


        if (
            !Number.isFinite(endBlock)
        ) {

            endBlock =
                latest;

        }


        // --------------------------------
        // Unique tokens
        // --------------------------------

        const tokens =
            new Map();


        let scannedFrom =
            endBlock;

        let scannedTo =
            endBlock;


        // --------------------------------
        // Scan Sikka trades
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


            // Newest trades first

            const reversed =
                [...logs].reverse();


            for (
                const log of reversed
            ) {

                const address =
                    getTokenAddress(
                        log
                    );


                if (!address) {
                    continue;
                }


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


            endBlock =
                startBlock - 1;


            if (
                startBlock === 0
            ) {

                break;

            }

        }


        // --------------------------------
        // Metadata
        // --------------------------------

        const tokenList =
            Array.from(
                tokens.values()
            );


        const result =
            await Promise.all(

                tokenList.map(
                    async token => {

                        const metadata =
                            await getTokenMetadata(
                                token.address
                            );


                        return {

                            address:
                                token.address,

                            name:
                                metadata.name,

                            symbol:
                                metadata.symbol,

                            logo:
                                metadata.logo,

                            exchange_rate:
                                metadata.exchange_rate,

                            decimals:
                                metadata.decimals,

                            tradeCount:
                                token.tradeCount

                        };

                    }
                )

            );


        // --------------------------------
        // Return
        // --------------------------------

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
