const SIKKA_CONTRACT =
    "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const TRADE_TOPIC =
    "0xf7dd8a134438de4c59401760e24ef5c6ccc9c74583b2b022085697f3021e59768";

const RPC =
    "https://api.shardeum.org";

const EXPLORER_API =
    "https://explorer.shardeum.org/api/v2";


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
            "Shardeum RPC error"
        );

    }


    return data.result;
}


async function getJson(url) {

    const response =
        await fetch(url);


    const text =
        await response.text();


    if (!response.ok) {

        throw new Error(
            `API ${response.status}: ${text}`
        );

    }


    return JSON.parse(text);
}


function parseTrade(log) {

    if (!log.topics ||
        log.topics.length < 3) {

        return null;

    }


    if (
        log.topics[0].toLowerCase() !==
        TRADE_TOPIC.toLowerCase()
    ) {

        return null;

    }


    const subject =
        "0x" +
        log.topics[2].slice(-40);


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

        address:
            subject.toLowerCase(),

        isBuy,

        transactionHash:
            log.transactionHash,

        blockNumber:
            parseInt(
                log.blockNumber,
                16
            )

    };

}


export default async function handler(req, res) {

    try {

        const search =
            (req.query.q || "")
                .trim()
                .toLowerCase();


        // --------------------------------
        // Get latest block
        // --------------------------------

        const latestHex =
            await rpc(
                "eth_blockNumber",
                []
            );


        const latest =
            parseInt(
                latestHex,
                16
            );


        console.log(
            "Latest block:",
            latest
        );


        // --------------------------------
        // Scan recent blocks
        // --------------------------------
        //
        // Start with 100,000 blocks.
        // We can expand this later.
        //

        const BLOCK_RANGE = 100000;

        const fromBlock =
            Math.max(
                0,
                latest - BLOCK_RANGE
            );


        console.log(
            "Scanning:",
            fromBlock,
            "to",
            latest
        );


        const logs =
            await rpc(
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
                            latest.toString(16),

                        topics: [
                            TRADE_TOPIC
                        ]
                    }
                ]
            );


        console.log(
            "Trade logs:",
            logs.length
        );


        // --------------------------------
        // Group trades by token
        // --------------------------------

        const tokenMap =
            new Map();


        for (const log of logs) {

            const trade =
                parseTrade(log);


            if (!trade)
                continue;


            const address =
                trade.address;


            if (!tokenMap.has(address)) {

                tokenMap.set(
                    address,
                    {
                        address,
                        buys: 0,
                        sells: 0,
                        trades: 0
                    }
                );

            }


            const token =
                tokenMap.get(address);


            if (trade.isBuy) {

                token.buys++;

            } else {

                token.sells++;

            }


            token.trades++;

        }


        let tokens =
            Array.from(
                tokenMap.values()
            );


        // --------------------------------
        // Fetch metadata
        // --------------------------------

        const result = [];


        // Limit metadata calls initially
        for (
            const token of tokens.slice(0, 30)
        ) {

            try {

                const metadata =
                    await getJson(
                        `${EXPLORER_API}/tokens/${token.address}`
                    );


                result.push({

                    address:
                        token.address,

                    name:
                        metadata.name ||
                        "Unknown Token",

                    symbol:
                        metadata.symbol ||
                        "-",

                    logo:
                        metadata.icon_url ||
                        "",

                    exchange_rate:
                        metadata.exchange_rate ||
                        null,

                    buys:
                        token.buys,

                    sells:
                        token.sells,

                    trades:
                        token.trades

                });


            } catch (error) {

                result.push({

                    address:
                        token.address,

                    name:
                        "Unknown Token",

                    symbol:
                        "-",

                    logo:
                        "",

                    exchange_rate:
                        null,

                    buys:
                        token.buys,

                    sells:
                        token.sells,

                    trades:
                        token.trades

                });

            }

        }


        // --------------------------------
        // Search
        // --------------------------------

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
                finalResult.length,

            tradeLogs:
                logs.length,

            scannedFrom:
                fromBlock,

            scannedTo:
                latest

        });


    } catch (error) {

        console.error(
            "Sikka Trade API ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Sikka Trade API failed",

            details:
                error.message

        });

    }

}
