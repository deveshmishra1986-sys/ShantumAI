const SIKKA_CONTRACT =
    "0xa1aAd2ED952C64248de99dD4D82ae07b87033bfa";

const TRADE_TOPIC =
    "0xf7dd8a134438de4c59401760e24ef5c6ccc9c74583b2b022085697f3021e59768";

const API =
    "https://explorer.shardeum.org/api/v2";

async function getJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Explorer API ${response.status}: ${text}`
        );
    }

    return response.json();
}


export default async function handler(req, res) {

    try {

        const search =
            (req.query.q || "")
                .trim()
                .toLowerCase();


        // Only get the first page of Sikka logs.
        // This prevents Vercel timeout.
        const url =
            `${API}/addresses/${SIKKA_CONTRACT}/logs`;


        console.log(
            "Getting Sikka logs:",
            url
        );


        const data =
            await getJson(url);


        const logs =
            data.items || [];


        console.log(
            "Logs received:",
            logs.length
        );


        const tokenMap =
            new Map();


        for (const log of logs) {

            const topics =
                log.topics || [];


            // Only Trade events
            if (
                !topics[0] ||
                topics[0].toLowerCase() !==
                TRADE_TOPIC.toLowerCase()
            ) {
                continue;
            }


            if (topics.length < 3)
                continue;


            // topic 2 = subject/token
            const tokenAddress =
                "0x" +
                topics[2].slice(-40);


            const dataHex =
                (log.data || "0x")
                    .slice(2);


            if (dataHex.length < 64)
                continue;


            // First 32-byte word = isBuy
            const isBuy =
                BigInt(
                    "0x" +
                    dataHex.substring(
                        0,
                        64
                    )
                ) === 1n;


            const key =
                tokenAddress.toLowerCase();


            if (!tokenMap.has(key)) {

                tokenMap.set(
                    key,
                    {
                        address:
                            tokenAddress,

                        buys: 0,

                        sells: 0,

                        trades: 0
                    }
                );

            }


            const token =
                tokenMap.get(key);


            if (isBuy) {

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
        // Search by contract address
        // --------------------------------

        if (search) {

            tokens =
                tokens.filter(
                    token =>
                        token.address
                            .toLowerCase()
                            .includes(search)
                );

        }


        // --------------------------------
        // Get metadata
        // --------------------------------

        const result = [];


        // IMPORTANT:
        // Only fetch metadata for a small
        // number of tokens per request.

        for (
            const token of tokens.slice(0, 30)
        ) {

            try {

                const metadata =
                    await getJson(
                        `${API}/tokens/${token.address}`
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

            } catch (e) {

                // Still return the token
                // if metadata is unavailable.

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
        // Search name / symbol
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

            scannedLogs:
                logs.length

        });


    } catch (error) {

        console.error(
            "Sikka API ERROR:",
            error
        );


        return res.status(500).json({

            error:
                "Sikka API failed",

            details:
                error.message

        });

    }

}
