let tokens = [];
let nextPageParams = null;

async function loadTokens() {
    try {
        let url = "/api/tokens";

        if (nextPageParams) {
            const params = new URLSearchParams(nextPageParams);
            url += "?" + params.toString();
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Failed to load tokens");
        }

        const data = await response.json();

        const newTokens = data.items || [];

        tokens = [...tokens, ...newTokens];

        nextPageParams = data.next_page_params || null;

        renderTokens();

        const loadMoreButton =
            document.getElementById("loadMore");

        if (loadMoreButton) {
            loadMoreButton.style.display =
                nextPageParams ? "block" : "none";
        }

    } catch (error) {
        console.error(error);

        document.getElementById("status").textContent =
            "Could not load tokens: " + error.message;
    }
}
