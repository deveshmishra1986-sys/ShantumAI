// ==================================================
// SHANTUM & SHARDEUM DASHBOARD
// ==================================================


// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const shantumCard =
  document.getElementById("shantum-card");

const shardeumCard =
  document.getElementById("shardeum-card");

const refreshButton =
  document.getElementById("refresh-button");


// --------------------------------------------------
// REFRESH BUTTON
// --------------------------------------------------

let isRefreshing = false;

async function refreshDashboard() {

  if (isRefreshing) {
    return;
  }

  isRefreshing = true;

  if (refreshButton) {

    refreshButton.disabled = true;

    refreshButton.classList.add("refreshing");

    refreshButton.innerHTML = `
      <span class="refresh-icon">↻</span>
      Refreshing...
    `;
  }

  try {

    await Promise.all([
      loadShantum(),
      loadShardeum()
    ]);

  } finally {

    isRefreshing = false;

    if (refreshButton) {

      refreshButton.disabled = false;

      refreshButton.classList.remove(
        "refreshing"
      );

      refreshButton.innerHTML = `
        <span class="refresh-icon">↻</span>
        Refresh Data
      `;
    }

  }

}


// --------------------------------------------------
// REFRESH BUTTON CLICK
// --------------------------------------------------

if (refreshButton) {

  refreshButton.addEventListener(
    "click",
    refreshDashboard
  );

}


// --------------------------------------------------
// LOAD SHANTUM
// --------------------------------------------------

async function loadShantum() {

  try {

    const [priceResponse, infoResponse] =
      await Promise.all([

        fetch(
          `/api/shantum-price?_=${Date.now()}`,
          {
            cache: "no-store"
          }
        ),

        fetch(
          `/api/shantum?_=${Date.now()}`,
          {
            cache: "no-store"
          }
        )

      ]);


    if (!priceResponse.ok) {

      throw new Error(
        `Shantum price HTTP ${priceResponse.status}`
      );

    }


    if (!infoResponse.ok) {

      throw new Error(
        `Shantum info HTTP ${infoResponse.status}`
      );

    }


    const priceData =
      await priceResponse.json();

    const infoData =
      await infoResponse.json();


    const price =
      Number(priceData.price);


    const currentSupply =
      Number(infoData.currentSupply);


    const maxSupply =
      Number(infoData.maxSupply);


    // ----------------------------------------------
    // SUPPLY PERCENTAGE
    // ----------------------------------------------

    let supplyPercentage = 0;

    if (
      maxSupply > 0 &&
      currentSupply >= 0
    ) {

      supplyPercentage =
        (currentSupply / maxSupply) * 100;

    }


    // Keep percentage sensible
    supplyPercentage =
      Math.min(
        Math.max(supplyPercentage, 0),
        100
      );


    // ----------------------------------------------
    // CONTRACT ADDRESS
    // ----------------------------------------------

    const contractAddress =
      infoData.contractAddress ||
      infoData.address ||
      priceData.contractAddress ||
      priceData.address ||
      "";


    // ----------------------------------------------
    // CONTRACT BUTTON
    // ----------------------------------------------

    let contractSection = "";

    if (contractAddress) {

      contractSection = `

        <div class="contract-section">

          <small>
            Contract Address
          </small>

          <div class="contract-row">

            <span
              class="contract-address"
              title="${contractAddress}"
            >
              ${contractAddress}
            </span>

            <button
              class="copy-button"
              type="button"
              data-address="${contractAddress}"
              onclick="copyContract(this)"
            >
              Copy
            </button>

          </div>

          <div
            class="copy-status"
            id="copy-status"
          ></div>

        </div>

      `;

    }


    // ----------------------------------------------
    // SHANTUM CARD
    // ----------------------------------------------

    shantumCard.innerHTML = `

      <div class="coin-header">

        <img
          class="coin-logo"
          src="/shantumlogo.jpg"
          alt="${priceData.symbol}"
          onerror="this.style.display='none';"
        >

        <div>

          <h2>
            ${priceData.name}
          </h2>

          <span>
            ${priceData.symbol}
          </span>

        </div>

      </div>


      <div class="coin-price">

        ${price.toFixed(6)} SHM

      </div>


      <div class="coin-info">

        <div>

          <small>
            Current Supply
          </small>

          <strong>

            ${currentSupply.toLocaleString(
              "en-US",
              {
                maximumFractionDigits: 6
              }
            )}

            STM

          </strong>

        </div>


        <div>

          <small>
            Max Supply
          </small>

          <strong>

            ${maxSupply.toLocaleString(
              "en-US"
            )}

            STM

          </strong>

        </div>

      </div>


      <!-- SUPPLY PROGRESS -->

      <div class="supply-section">

        <div class="supply-header">

          <span>
            Supply Progress
          </span>

          <strong>
            ${supplyPercentage.toFixed(2)}%
          </strong>

        </div>

        <div class="supply-bar">

          <div
            class="supply-fill"
            style="width: ${supplyPercentage}%"
          ></div>

        </div>

      </div>


      ${contractSection}


      <a
        class="explorer-button interactive-button"
        href="${priceData.explorer}"
        target="_blank"
        rel="noopener noreferrer"
      >
        View Explorer ↗
      </a>


      <!-- SOCIAL LINKS -->

      <div class="social-links">

        <a
          href="https://t.me/shantumcoin"
          target="_blank"
          rel="noopener noreferrer"
          class="social-button telegram-button interactive-button"
        >

          <span class="social-icon">
            ✈
          </span>

          Telegram

        </a>


        <a
          href="https://x.com/Shantumcoin"
          target="_blank"
          rel="noopener noreferrer"
          class="social-button x-button interactive-button"
        >

          <span class="social-icon">
            𝕏
          </span>

          X

        </a>


        <a
          href="https://join.sikka.fun/0ty8uzq"
          target="_blank"
          rel="noopener noreferrer"
          class="social-button trade-button interactive-button"
        >

          <span class="social-icon">
            ↗
          </span>

          Trade

        </a>

      </div>

    `;

  }

  catch (error) {

    console.error(
      "Shantum error:",
      error
    );


    shantumCard.innerHTML = `

      <div class="error">

        Unable to load Shantum data.

      </div>

    `;

  }

}


// --------------------------------------------------
// COPY CONTRACT ADDRESS
// --------------------------------------------------

async function copyContract(button) {

  const address =
    button.getAttribute(
      "data-address"
    );

  if (!address) {
    return;
  }


  try {

    await navigator.clipboard.writeText(
      address
    );


    button.innerText =
      "✓ Copied";


    button.classList.add(
      "copied"
    );


    const status =
      document.getElementById(
        "copy-status"
      );


    if (status) {

      status.innerText =
        "Contract address copied";

    }


    setTimeout(() => {

      button.innerText =
        "Copy";

      button.classList.remove(
        "copied"
      );

      if (status) {

        status.innerText = "";

      }

    }, 2000);


  }

  catch (error) {

    console.error(
      "Copy failed:",
      error
    );

    button.innerText =
      "Copy failed";

  }

}


// Make available to inline onclick
window.copyContract =
  copyContract;


// --------------------------------------------------
// LOAD SHARDEUM
// --------------------------------------------------

async function loadShardeum() {

  try {

    const response =
      await fetch(
        `/api/shm-price?_=${Date.now()}`,
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        `SHM HTTP ${response.status}`
      );

    }


    const data =
      await response.json();


    let priceText =
      "Unavailable";


    if (
      data.success &&
      data.priceUsd !== undefined &&
      data.priceUsd !== null
    ) {

      priceText =
        "$" +
        Number(data.priceUsd).toFixed(8);

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

          <h2>
            Shardeum
          </h2>

          <span>
            SHM
          </span>

        </div>

      </div>


      <div class="coin-price">

        ${priceText}

      </div>


      <div class="coin-info">

        <div>

          <small>
            Network
          </small>

          <strong>
            Shardeum
          </strong>

        </div>


        <div>

          <small>
            Chain ID
          </small>

          <strong>
            8118
          </strong>

        </div>

      </div>


      <a
        class="explorer-button interactive-button"
        href="https://explorer.shardeum.org/"
        target="_blank"
        rel="noopener noreferrer"
      >
        View Explorer ↗
      </a>

    `;

  }

  catch (error) {

    console.error(
      "Shardeum error:",
      error
    );


    shardeumCard.innerHTML = `

      <div class="error">

        Unable to load Shardeum data.

      </div>

    `;

  }

}


// --------------------------------------------------
// INITIAL LOAD
// --------------------------------------------------

loadShantum();

loadShardeum();


// --------------------------------------------------
// AUTO REFRESH EVERY 60 SECONDS
// --------------------------------------------------

setInterval(
  () => {

    if (!isRefreshing) {

      loadShantum();

      loadShardeum();

    }

  },
  60 * 1000
);
