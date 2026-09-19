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
// HEX HELPER
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
// RPC CALL
// ======================================

async function rpc(method, params) {

    const response =
        await fetch(RPC, {
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
            "Shardeum RPC error"
        );

    }


    return data.result;
}


// ======================================
// BATCH RPC CALL
// ======================================

async function rpcBatch(requests) {

    if (!requests.length) {
        return [];
    }


    const response =
        await fetch(RPC, {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify(
                requests
            )

        });


    const data =
        await response.json();


    if (!Array.isArray(data)) {

        throw new Error(
            "Shardeum RPC did not return batch response"
        );

    }


    return data;

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
// GET SIKKA TRADE LOGS
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


    return await rpc(
        "eth_getLogs",
        [filter]
    );

}


// ======================================
// GET TOKEN ADDRESS FROM TRADE
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


    const subject =
        log.topics[2];


    if (!subject) {
        return null;
    }


    return (
        "0x" +
        subject.slice(-40)
    ).toLowerCase();

}


// ======================================
// DECODE ERC20 STRING
// ======================================

function decodeString(hex) {

    if (
        !hex ||
        hex === "0x"
    ) {

        return "";

    }


    try {

        let data =
            hex.startsWith("0x")
                ? hex.slice(2)
                : hex;


        // Dynamic ABI string

        if (data.length >= 128) {

            const offset =
                parseInt(
                    data.slice(0, 64),
                    16
                );


            if (
                offset * 2 + 64 <=
                data.length
            ) {

                const length =
                    parseInt(
                        data.slice(
                            offset * 2,
                            offset * 2 + 64
                        ),
                        16
                    );


                const start =
                    offset * 2 + 64;


                const end =
                    start + length * 2;


                if (
                    end <= data.length
                ) {

                    const bytes =
                        data.slice(
                            start,
                            end
                        );


                    return hexToUtf8(
                        bytes
                    );

                }

            }

        }


        // bytes32 fallback

        if (data.length >= 64) {

            const bytes =
                data.slice(0, 64)
                    .replace(
                        /00+$/,
                        ""
                    );


            return hexToUtf8(
                bytes
            );

        }


    } catch (error) {

        console.log(
            "String decode error:",
            error.message
        );

    }


    return "";

}


// ======================================
// HEX → UTF8
// ======================================

function hexToUtf8(hex) {

    try {

        const bytes = [];

        for (
            let i = 0;
            i < hex.length;
            i += 2
        ) {

            const value =
                parseInt(
                    hex.substring(
                        i,
                        i + 2
                    ),
                    16
                );


            if (
                value !== 0 &&
                !Number.isNaN(value)
            ) {

                bytes.push(value);

            }

        }


        return new TextDecoder()
            .decode(
                new Uint8Array(bytes)
            )
            .replace(
                /\0/g,
                ""
            )
            .trim();

    } catch {

        return "";

    }

}


// ======================================
// DIRECT TOKEN METADATA
// ======================================

async function getDirectTokenMetadata(
    addresses
) {

    const requests = [];

    let id = 1000;


    for (
        const address of addresses
    ) {

        // name()
        requests.push({

            jsonrpc: "2.0",

            id: id++,

            method: "eth_call",

            params: [
                {
                    to: address,
                    data: "0x06fdde03"
                },
                "latest"
            ]

        });


        // symbol()
        requests.push({

            jsonrpc: "2.0",

            id: id++,

            method: "eth_call",

            params: [
                {
                    to: address,
                    data: "0x95d89b41"
                },
                "latest"
            ]

        });


        // decimals()
        requests.push({

            jsonrpc: "2.0",

            id: id++,

            method: "eth_call",

            params: [
                {
                    to: address,
                    data: "0x313ce567"
                },
                "latest"
            ]

        });

    }


    if (!requests.length) {
        return new Map();
    }


    const responses =
        await rpcBatch(
            requests
        );


    const responseMap =
        new Map();


    for (
        const response of responses
    ) {

        responseMap.set(
            response.id,
            response
        );

    }


    const result =
        new Map();


    let currentId =
        1000;


    for (
        const address of addresses
    ) {

        const nameResponse =
            responseMap.get(
                currentId++
            );


        const symbolResponse =
            responseMap.get(
                currentId++
            );


        const decimalsResponse =
            responseMap.get(
                currentId++
            );


        let name = "";

        let symbol = "";

        let decimals = null;


        if (
            nameResponse &&
            nameResponse.result
        ) {

            name =
                decodeString(
                    nameResponse.result
                );

        }


        if (
            symbolResponse &&
            symbolResponse.result
        ) {

            symbol =
                decodeString(
                    symbolResponse.result
                );

        }


        if (
            decimalsResponse &&
            decimalsResponse.result
        ) {

            try {

                decimals =
                    parseInt(
                        decimalsResponse.result,
                        16
                    );

            } catch {

                decimals = null;

            }

        }


        result.set(
            address.toLowerCase(),
            {
                name,
                symbol,
                decimals
            }
        );

    }


    return result;

}


// ======================================
// EXPLORER METADATA
// ======================================

async function getExplorerMetadata(
    address
) {

    try {

        const response =
            await fetch(
                `${EXPLORER_API}/tokens/${address}`
            );


        if (!response.ok) {

            return null;

        }


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

    } catch {

        return null;

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
        // Starting block
        // --------------------------------

        let endBlock;


        if (
            req.query.beforeBlock
        ) {

            endBlock =
                Number(
                    req.query.beforeBlock
                );

        } else {

            endBlock =
                latest;

        }


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
                "Scanning:",
                startBlock,
                "to",
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


            // Reverse so recent
            // events are processed first

            const reversedLogs =
                [...logs].reverse();


            for (
                const log of reversedLogs
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
        // Token addresses
        // --------------------------------

        const addresses =
            Array.from(
                tokens.keys()
            );


        // --------------------------------
        // Get direct ERC20 metadata
        // --------------------------------

        const directMetadata =
            await getDirectTokenMetadata(
                addresses
            );


        // --------------------------------
        // Build final results
        // --------------------------------

        const result = [];


        for (
            const token of
            tokens.values()
        ) {

            const address =
                token.address;


            const direct =
                directMetadata.get(
                    address
                ) || {};


            // Try explorer metadata
            const explorer =
                await getExplorerMetadata(
                    address
                );


            const name =
                direct.name ||
                explorer?.name ||
                "Unknown Token";


            const symbol =
                direct.symbol ||
                explorer?.symbol ||
                "-";


            const logo =
                explorer?.logo ||
                "";


            const exchangeRate =
                explorer?.exchange_rate ||
                null;


            result.push({

                address,

                name,

                symbol,

                logo,

                exchange_rate:
                    exchangeRate,

                decimals:
                    direct.decimals,

                tradeCount:
                    token.tradeCount

            });

        }


        // --------------------------------
        // Response
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
