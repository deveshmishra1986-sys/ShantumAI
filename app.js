const shantumCard = document.getElementById("shantum-card");
const shardeumCard = document.getElementById("shardeum-card");


// --------------------------------------------------
// LOAD SHANTUM
// --------------------------------------------------

async function loadShantum() {
  try {
    const [priceResponse, infoResponse] = await Promise.all([
      fetch(`/api/shantum-price?_=${Date.now()}`, {
        cache: "no-store"
      }),

      fetch(`/api/shantum?_=${Date.now()}`, {
        cache: "no-store"
      })
    ]);

    if (!priceResponse.ok) {
      throw new Error(`Shantum price HTTP ${priceResponse.status}`);
    }

    if (!infoResponse.ok) {
      throw new Error(`Shantum info HTTP ${infoResponse.status}`);
    }

    const priceData = await priceResponse.json();
    const infoData = await infoResponse.json();

    const price =
      Number(priceData.price);

    const currentSupply =
      Number(infoData.currentSupply);

    const maxSupply =
      Number(infoData.maxSupply);

    shantumCard.innerHTML = `
      <div class="coin-header">

        <img
          class="coin-logo"
          src="${priceData.image}"
          alt="${priceData.symbol}"
          onerror="this.style.display='none';"
        >

        <div>
          <h2>${priceData.name}</h2>
          <span>${priceData.symbol}</span>
        </div>

      </div>

      <div class="coin-price">
        ${price.toFixed(6)} SHM
      </div>

      <div class="coin-info">

        <div>
          <small>Current Supply</small>
          <strong>
            ${currentSupply.toLocaleString("en-US", {
              maximumFractionDigits: 6
            })} STM
          </strong>
        </div>

        <div>
          <small>Max Supply</small>
          <strong>
            ${maxSupply.toLocaleString("en-US")} STM
          </strong>
        </div>

      </div>

      <a
        class="explorer-button"
        href="${priceData.explorer}"
        target="_blank"
        rel="noopener noreferrer"
      >
        View Explorer ↗
      </a>
    `;

  } catch (error) {

    console.error("Shantum error:", error);

    shantumCard.innerHTML = `
      <div class="error">
        Unable to load Shantum data.
      </div>
    `;
  }
}


// --------------------------------------------------
// LOAD SHARDEUM
// --------------------------------------------------

async function loadShardeum() {

  try {

    const response = await fetch(
      `/api/shm-price?_=${Date.now()}`,
      {
        cache: "no-store"
      }
    );

    const data = await response.json();

    let priceText = "Unavailable";

    if (
      data.success &&
      data.priceUsd !== undefined &&
      data.priceUsd !== null
    ) {
      priceText =
        "$" + Number(data.priceUsd).toFixed(6);
    }

    shardeumCard.innerHTML = `

      <div class="coin-header">

        <img
          class="coin-logo"
          src="/shardeum-logo.png"
          alt="SHM"
          onerror="this.style.display='none';"
        >

        <div>
          <h2>Shardeum</h2>
          <span>SHM</span>
        </div>

      </div>

      <div class="coin-price">
        ${priceText}
      </div>

      <div class="coin-info">

        <div>
          <small>Network</small>
          <strong>Shardeum</strong>
        </div>

        <div>
          <small>Chain ID</small>
          <strong>8118</strong>
        </div>

      </div>

      <a
        class="explorer-button"
        href="https://explorer.shardeum.org/"
        target="_blank"
        rel="noopener noreferrer"
      >
        View Explorer ↗
      </a>

    `;

  } catch (error) {

    console.error("Shardeum error:", error);

    shardeumCard.innerHTML = `
      <div class="error">
        Unable to load Shardeum data.
      </div>
    `;
  }
}


// --------------------------------------------------
// START
// --------------------------------------------------

loadShantum();
loadShardeum();


// Refresh every 60 seconds
setInterval(() => {
  loadShantum();
  loadShardeum();
}, 60000);
