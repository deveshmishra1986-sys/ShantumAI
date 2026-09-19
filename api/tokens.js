export default async function handler(req, res) {

    try {

        const params = new URLSearchParams();

        Object.entries(req.query).forEach(
            ([key, value]) => {

                if (
                    value !== undefined &&
                    value !== null &&
                    value !== ""
                ) {
                    params.append(key, value);
                }

            }
        );

        const url =
            `https://explorer.shardeum.org/api/v2/tokens?${params.toString()}`;

        console.log("Calling:", url);

        const response =
            await fetch(url);

        const text =
            await response.text();

        if (!response.ok) {

            return res
                .status(response.status)
                .json({
                    error: "Shardeum Explorer API error",
                    details: text
                });

        }

        const data =
            JSON.parse(text);

        return res
            .status(200)
            .json(data);

    } catch (error) {

        console.error(error);

        return res
            .status(500)
            .json({
                error: "Server error",
                details: error.message
            });

    }

}
