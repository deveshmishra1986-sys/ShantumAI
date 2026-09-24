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
      loadSikkaTrades()
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

    const [
      priceResponse,
      infoResponse,
      shmResponse
    ] = await Promise.all([

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
      ),

      fetch(
        `/api/shm-price?_=${Date.now()}`,
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


    if (!shmResponse.ok) {
      throw new Error(
        `SHM price HTTP ${shmResponse.status}`
      );
    }


    const priceData =
      await priceResponse.json();

    const infoData =
      await infoResponse.json();

    const shmData =
      await shmResponse.json();


    // ----------------------------------------------
    // STM / SHM PRICE
    // ----------------------------------------------

    const price =
      Number(priceData.price);


    // ----------------------------------------------
    // SHM / USD PRICE
    // ----------------------------------------------

    const shmUsd =
      Number(shmData.priceUsd);


    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error(
        "Invalid Shantum price"
      );
    }


    if (
      !Number.isFinite(shmUsd) ||
      shmUsd <= 0
    ) {
      throw new Error(
        "SHM/USD price unavailable"
      );
    }


    // ----------------------------------------------
    // STM / USD PRICE
    // ----------------------------------------------

    const stmUsd =
      price * shmUsd;


    // ----------------------------------------------
    // SUPPLY
    // ----------------------------------------------

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


    supplyPercentage =
      Math.min(
        Math.max(
          supplyPercentage,
          0
        ),
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
    // CONTRACT SECTION
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


      <!-- STM USD PRICE -->

      <div class="coin-price">

        $${stmUsd.toFixed(9)}

      </div>


      <!-- STM / SHM PRICE -->

      <div
        style="
          font-size: 14px;
          opacity: 0.65;
          margin-top: -12px;
          margin-bottom: 20px;
        "
      >

        ${price.toFixed(9)} SHM

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



async function loadSikkaTrades() {
  const card = document.getElementById("sikka-trades-card");
  if (!card) return;

  try {
    const [tradesResponse, shmResponse] = await Promise.all([
      fetch(`/api/sikka-live-trades?_=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/shm-price?_=${Date.now()}`, { cache: "no-store" })
    ]);

    if (!tradesResponse.ok) throw new Error(`Trades API HTTP ${tradesResponse.status}`);
    if (!shmResponse.ok) throw new Error(`SHM/USD API HTTP ${shmResponse.status}`);

    const result = await tradesResponse.json();
    const shmData = await shmResponse.json();
    if (!result.success) throw new Error(result.error || "Unable to load trades");

    const shmUsd = Number(shmData.priceUsd);
    if (!Number.isFinite(shmUsd) || shmUsd <= 0) throw new Error("SHM/USD price unavailable");

    const trades = Array.isArray(result.trades) ? result.trades : [];

    if (!trades.length) {
      card.innerHTML = `<div class="sikka-trades-card"><div class="sikka-title"><span>🔥</span><span>LIVE SIKKA TRADES</span><span class="live-dot"></span></div><p style="color:#8492aa;">No live trades found.</p></div>`;
      return;
    }

    card.innerHTML = `
      <div class="sikka-trades-card">
        <div class="sikka-title"><span>🔥</span><span>LIVE SIKKA TRADES</span><span class="live-dot"></span></div>
        <div class="sikka-table">
          <div class="sikka-header"><div>TOKEN</div><div>ACTION</div><div>PRICE (USD)</div><div>DATE / TIME</div></div>
          ${trades.map(trade => renderTradeRowUSD(trade, shmUsd)).join("")}
        </div>
        <div class="sikka-updated">● Live data from Sikka</div>
      </div>`;
  } catch (error) {
    console.error("Sikka trades error:", error);
    card.innerHTML = `<div class="sikka-trades-card"><div class="sikka-title"><span>🔥</span><span>LIVE SIKKA TRADES</span></div><p style="color:#ff5264;">Unable to load live trades</p><p style="color:#66758c;font-size:11px;">${escapeHtml(error.message)}</p></div>`;
  }
}

function renderTradeRowUSD(trade, shmUsd) {
  const type = String(trade.type || "").toLowerCase();
  const isBuy = type === "buy";
  const actionClass = isBuy ? "buy" : "sell";
  const actionText = isBuy ? "🟢 BUY" : "🔴 SELL";
  const priceShm = Number(trade.price);
  const priceUsd = Number.isFinite(priceShm) ? priceShm * shmUsd : NaN;
  const price = Number.isFinite(priceUsd) ? `$${priceUsd.toFixed(12)}` : "—";

  let timestamp = Number(trade.timestamp || trade.t || 0);
  if (timestamp > 0 && timestamp < 100000000000) timestamp *= 1000;
  const date = timestamp > 0 ? new Date(timestamp) : null;
  let dateTime = "—";
  if (date && !Number.isNaN(date.getTime())) {
    dateTime = new Intl.DateTimeFormat("en-IN", { timeZone:"Asia/Kolkata", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true }).format(date) + " IST";
  }

  const name = trade.name || trade.ticker || "Unknown";
  const image = trade.image_url ? `<img src="${escapeAttribute(trade.image_url)}" class="trade-token-logo" onerror="this.style.display='none'">` : "";
  return `<div class="sikka-row"><div class="token-name">${image}<span>${escapeHtml(name)}</span></div><div class="trade-action ${actionClass}">${actionText}</div><div class="trade-price">${price}</div><div class="trade-time" title="${escapeAttribute(dateTime)}">${escapeHtml(dateTime)}</div></div>`;
}

// SHANTUM SIKKA USD BASELINE CHART
// ==================================================

let stmChart = null;

let stmCandleSeries = null;

let currentTimeframe = "24h";


// --------------------------------------------------
// LOAD STM CHART
// --------------------------------------------------

async function loadSTMChart(
  timeframe = "24h"
) {

  const chartContainer =
    document.getElementById(
      "stm-chart"
    );


  if (!chartContainer) {
    return;
  }


  try {

    // ----------------------------------------------
    // LOADING
    // ----------------------------------------------

    chartContainer.innerHTML = `

      <div class="chart-loading">

        Loading STM/USD market data...

      </div>

    `;


    // ----------------------------------------------
    // GET CANDLES + SHM USD PRICE
    // ----------------------------------------------

    const [
      candleResponse,
      shmResponse
    ] = await Promise.all([

      fetch(
        `/api/sikka-candles?timeframe=${timeframe}&limit=200&_=${Date.now()}`,
        {
          cache: "no-store"
        }
      ),

      fetch(
        `/api/shm-price?_=${Date.now()}`,
        {
          cache: "no-store"
        }
      )

    ]);


    if (!candleResponse.ok) {

      throw new Error(
        `Candle API HTTP ${candleResponse.status}`
      );

    }


    if (!shmResponse.ok) {

      throw new Error(
        `SHM/USD API HTTP ${shmResponse.status}`
      );

    }


    const data =
      await candleResponse.json();


    const shmData =
      await shmResponse.json();


    // ----------------------------------------------
    // VALIDATE CANDLE DATA
    // ----------------------------------------------

    if (
      !data.success ||
      !Array.isArray(data.candles) ||
      data.candles.length === 0
    ) {

      throw new Error(
        "No candle data available"
      );

    }


    // ----------------------------------------------
    // SHM/USD PRICE
    // ----------------------------------------------

    const shmUsd =
      Number(shmData.priceUsd);


    if (
      !Number.isFinite(shmUsd) ||
      shmUsd <= 0
    ) {

      throw new Error(
        "SHM/USD price unavailable"
      );

    }


    // ----------------------------------------------
    // REMOVE OLD CHART
    // ----------------------------------------------

    if (stmChart) {

      try {

        stmChart.remove();

      }

      catch (error) {

        console.warn(
          "Chart remove warning:",
          error
        );

      }

      stmChart = null;

      stmCandleSeries = null;

    }


    chartContainer.innerHTML = "";


    // ----------------------------------------------
    // CONVERT STM/SHM → STM/USD
    // ----------------------------------------------

    const chartData =
      data.candles

        .map(candle => {

          const closeSHM =
            Number(candle.c);

          const closeUSD =
            closeSHM * shmUsd;


          return {

            time:
              Number(candle.t),

            value:
              closeUSD

          };

        })

        .filter(point => {

          return (

            Number.isFinite(
              point.time
            )

            &&

            Number.isFinite(
              point.value
            )

            &&

            point.value >= 0

          );

        });


    if (chartData.length === 0) {

      throw new Error(
        "Invalid STM/USD candle values"
      );

    }


    // ----------------------------------------------
    // BASELINE PRICE
    // ----------------------------------------------

    const baselinePrice =
      chartData[0].value;


    // ----------------------------------------------
    // CREATE CHART
    // ----------------------------------------------

    stmChart =
      LightweightCharts.createChart(

        chartContainer,

        {

          width:
            chartContainer.clientWidth,

          height:
            430,


          layout: {

            background: {

              color:
                "transparent"

            },

            textColor:
              "#aaa"

          },


          grid: {

            vertLines: {

              color:
                "rgba(255,255,255,0.05)"

            },

            horzLines: {

              color:
                "rgba(255,255,255,0.05)"

            }

          },


          rightPriceScale: {

            borderColor:
              "rgba(255,255,255,0.10)"

          },


          timeScale: {

            borderColor:
              "rgba(255,255,255,0.10)",

            timeVisible:
              true

          },


          localization: {

            priceFormatter:
              price => {

                return (
                  "$" +
                  Number(price)
                    .toFixed(9)
                );

              }

          }

        }

      );


    // ----------------------------------------------
    // BASELINE SERIES
    // ----------------------------------------------

    stmCandleSeries =

      stmChart.addSeries(

        LightweightCharts.BaselineSeries,

        {

          baseValue: {

            type:
              "price",

            price:
              baselinePrice

          },


          topLineColor:
            "#22c55e",

          topFillColor1:
            "rgba(34,197,94,0.30)",

          topFillColor2:
            "rgba(34,197,94,0.05)",


          bottomLineColor:
            "#ef4444",

          bottomFillColor1:
            "rgba(239,68,68,0.05)",

          bottomFillColor2:
            "rgba(239,68,68,0.30)",


          priceFormat: {

            type:
              "price",

            precision:
              9,

            minMove:
              0.000000001

          },


          lastValueVisible:
            true,

          priceLineVisible:
            true

        }

      );


    // ----------------------------------------------
    // SET CHART DATA
    // ----------------------------------------------

    stmCandleSeries.setData(
      chartData
    );


    // ----------------------------------------------
    // FIT CHART
    // ----------------------------------------------

    stmChart
      .timeScale()
      .fitContent();


    // ----------------------------------------------
    // RESPONSIVE
    // ----------------------------------------------

    window.removeEventListener(
      "resize",
      resizeSTMChart
    );


    window.addEventListener(
      "resize",
      resizeSTMChart
    );

  }


  catch (error) {

    console.error(
      "STM/USD chart error:",
      error
    );


    chartContainer.innerHTML = `

      <div class="chart-error">

        Unable to load STM/USD market data.

        <br>

        <small>
          ${error.message}
        </small>

      </div>

    `;

  }

}


// --------------------------------------------------
// RESIZE CHART
// --------------------------------------------------

function resizeSTMChart() {

  const container =
    document.getElementById(
      "stm-chart"
    );


  if (
    stmChart &&
    container
  ) {

    stmChart.resize(

      container.clientWidth,

      430

    );

  }

}


// --------------------------------------------------
// TIMEFRAME BUTTONS
// --------------------------------------------------

document
  .querySelectorAll(
    ".timeframe-button"
  )
  .forEach(button => {

    button.addEventListener(

      "click",

      function () {

        const timeframe =
          this.dataset.timeframe;


        if (!timeframe) {
          return;
        }


        currentTimeframe =
          timeframe;


        document
          .querySelectorAll(
            ".timeframe-button"
          )
          .forEach(btn => {

            btn.classList.remove(
              "active"
            );

          });


        this.classList.add(
          "active"
        );


        loadSTMChart(
          timeframe
        );

      }

    );

  });


// --------------------------------------------------
// INITIAL CHART
// DEFAULT = 24 HOURS
// --------------------------------------------------

loadSTMChart("24h");
