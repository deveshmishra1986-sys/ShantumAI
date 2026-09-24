// ==================================================
// SHANTUM AI DASHBOARD
// ==================================================

const CONTRACT_FALLBACK =
  "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

const shantumCard = document.getElementById("shantum-card");
const tradesCard = document.getElementById("sikka-trades-card");
const refreshButton = document.getElementById("refresh-button");

let isRefreshing = false;
let stmChart = null;
let stmSeries = null;
let currentTimeframe = "24h";

// --------------------------------------------------
// REFRESH
// --------------------------------------------------

async function refreshDashboard() {
  if (isRefreshing) return;

  isRefreshing = true;

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.classList.add("refreshing");
    refreshButton.innerHTML =
      '<span class="refresh-icon">↻</span> Refreshing...';
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
      refreshButton.classList.remove("refreshing");
      refreshButton.innerHTML =
        '<span class="refresh-icon">↻</span> Refresh Data';
    }
  }
}

if (refreshButton) {
  refreshButton.addEventListener("click", refreshDashboard);
}

// --------------------------------------------------
// SHANTUM
// --------------------------------------------------

async function loadShantum() {
  if (!shantumCard) return;

  try {
    const [priceResponse, infoResponse, shmResponse] =
      await Promise.all([
        fetch(`/api/shantum-price?_=${Date.now()}`, {
          cache: "no-store"
        }),
        fetch(`/api/shantum?_=${Date.now()}`, {
          cache: "no-store"
        }),
        fetch(`/api/shm-price?_=${Date.now()}`, {
          cache: "no-store"
        })
      ]);

    if (!priceResponse.ok) {
      throw new Error(`Shantum price HTTP ${priceResponse.status}`);
    }

    if (!infoResponse.ok) {
      throw new Error(`Shantum info HTTP ${infoResponse.status}`);
    }

    if (!shmResponse.ok) {
      throw new Error(`SHM price HTTP ${shmResponse.status}`);
    }

    const priceData = await priceResponse.json();
    const infoData = await infoResponse.json();
    const shmData = await shmResponse.json();

    const price = Number(priceData.price);
    const shmUsd = Number(shmData.priceUsd);

    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Invalid Shantum price");
    }

    if (!Number.isFinite(shmUsd) || shmUsd <= 0) {
      throw new Error("SHM/USD price unavailable");
    }

    const stmUsd = price * shmUsd;

    const currentSupply = Number(infoData.currentSupply);
    const maxSupply = Number(infoData.maxSupply);

    let supplyPercentage = 0;

    if (
      Number.isFinite(currentSupply) &&
      Number.isFinite(maxSupply) &&
      maxSupply > 0
    ) {
      supplyPercentage = Math.min(
        Math.max((currentSupply / maxSupply) * 100, 0),
        100
      );
    }

    const contractAddress =
      infoData.contractAddress ||
      infoData.address ||
      priceData.contract ||
      priceData.contractAddress ||
      CONTRACT_FALLBACK;

    const explorer =
      priceData.explorer ||
      `https://explorer.shardeum.org/address/${contractAddress}`;

    shantumCard.innerHTML = `
      <div class="coin-header">
        <img
          class="coin-logo"
          src="/shantumlogo.jpg"
          alt="${priceData.symbol || "STM"}"
          onerror="this.onerror=null;this.src='/shantum-logo.png';"
        >

        <div>
          <h2>${priceData.name || "Shantum"}</h2>
          <span>${priceData.symbol || "STM"}</span>
        </div>
      </div>

      <div class="coin-price">
        $${stmUsd.toFixed(9)}
      </div>

      <div style="
        font-size:14px;
        opacity:.65;
        margin-top:-12px;
        margin-bottom:20px;
      ">
        ${price.toFixed(9)} SHM
      </div>

      <div class="coin-info">
        <div>
          <small>Current Supply</small>
          <strong>
            ${
              Number.isFinite(currentSupply)
                ? currentSupply.toLocaleString("en-US", {
                    maximumFractionDigits: 6
                  })
                : "—"
            }
            STM
          </strong>
        </div>

        <div>
          <small>Max Supply</small>
          <strong>
            ${
              Number.isFinite(maxSupply)
                ? maxSupply.toLocaleString("en-US")
                : "—"
            }
            STM
          </strong>
        </div>
      </div>

      <div class="supply-section">
        <div class="supply-header">
          <span>Supply Progress</span>
          <strong>${supplyPercentage.toFixed(2)}%</strong>
        </div>

        <div class="supply-bar">
          <div
            class="supply-fill"
            style="width:${supplyPercentage}%"
          ></div>
        </div>
      </div>

      <div class="contract-section">
        <small>Contract Address</small>

        <div class="contract-row">
          <span
            class="contract-address"
            title="${contractAddress}"
          >${contractAddress}</span>

          <button
            class="copy-button"
            type="button"
            data-address="${contractAddress}"
            onclick="copyContract(this)"
          >Copy</button>
        </div>

        <div class="copy-status" id="copy-status"></div>
      </div>

      <a
        class="explorer-button"
        href="${explorer}"
        target="_blank"
        rel="noopener noreferrer"
      >View Explorer ↗</a>

      <div class="social-links">
        <a
          href="https://t.me/shantumcoin"
          target="_blank"
          rel="noopener noreferrer"
          class="social-button"
        >✈ Telegram</a>

        <a
          href="https://x.com/Shantumcoin"
          target="_blank"
          rel="noopener noreferrer"
          class="social-button"
        >𝕏 X</a>

        <a
          href="https://join.sikka.fun/0ty8uzq"
          target="_blank"
          rel="noopener noreferrer"
          class="social-button"
        >↗ Trade</a>
      </div>
    `;
  } catch (error) {
    console.error("Shantum error:", error);

    shantumCard.innerHTML = `
      <div class="error">
        Unable to load Shantum data.
        <br>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
  }
}

// --------------------------------------------------
// COPY CONTRACT
// --------------------------------------------------

async function copyContract(button) {
  const address = button?.getAttribute("data-address");
  if (!address) return;

  try {
    await navigator.clipboard.writeText(address);

    button.innerText = "✓ Copied";
    button.classList.add("copied");

    const status = document.getElementById("copy-status");
    if (status) status.innerText = "Contract address copied";

    setTimeout(() => {
      button.innerText = "Copy";
      button.classList.remove("copied");
      if (status) status.innerText = "";
    }, 2000);
  } catch (error) {
    console.error("Copy failed:", error);
    button.innerText = "Copy failed";
  }
}

window.copyContract = copyContract;

// --------------------------------------------------
// SIKKA LIVE TRADES
// --------------------------------------------------

async function loadSikkaTrades() {
  if (!tradesCard) return;

  try {
    const [response, shmResponse] = await Promise.all([
      fetch(`/api/sikka-live-trades?_=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/shm-price?_=${Date.now()}`, { cache: "no-store" })
    ]);

    if (!response.ok) {
      throw new Error(`Trades API HTTP ${response.status}`);
    }

    if (!shmResponse.ok) {
      throw new Error(`SHM/USD API HTTP ${shmResponse.status}`);
    }

    const result = await response.json();
    const shmData = await shmResponse.json();

    if (!result.success) {
      throw new Error(result.error || "Unable to load trades");
    }

    const shmUsd = Number(shmData.priceUsd);

    if (!Number.isFinite(shmUsd) || shmUsd <= 0) {
      throw new Error("SHM/USD price unavailable");
    }

    const trades = Array.isArray(result.trades)
      ? result.trades
      : [];

    if (!trades.length) {
      tradesCard.innerHTML = `
        <div class="sikka-trades-card">
          <div class="sikka-title">
            <span>🔥</span>
            <span>LIVE SIKKA TRADES</span>
            <span class="live-dot"></span>
          </div>
          <p style="color:#8492aa;">No live trades found.</p>
        </div>
      `;
      return;
    }

    tradesCard.innerHTML = `
      <div class="sikka-trades-card">
        <div class="sikka-title">
          <span>🔥</span>
          <span>LIVE SIKKA TRADES</span>
          <span class="live-dot"></span>
        </div>

        <div class="sikka-table">
          <div class="sikka-header">
            <div>TOKEN</div>
            <div>ACTION</div>
            <div>PRICE (USD)</div>
            <div>DATE / TIME</div>
          </div>

          ${trades.map(trade => renderTradeRow(trade, shmUsd)).join("")}
        </div>

        <div class="sikka-updated">
          ● Live data from Sikka
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Sikka trades error:", error);

    tradesCard.innerHTML = `
      <div class="sikka-trades-card">
        <div class="sikka-title">
          <span>🔥</span>
          <span>LIVE SIKKA TRADES</span>
        </div>

        <p style="color:#ff5264;">
          Unable to load live trades
        </p>

        <p style="color:#66758c;font-size:11px;">
          ${escapeHtml(error.message)}
        </p>
      </div>
    `;
  }
}

function formatTradeDateTime(timestamp) {
  let value = Number(timestamp);

  if (!Number.isFinite(value) || value <= 0) {
    return {
      short: "—",
      full: "Trade time unavailable"
    };
  }

  // Sikka may return seconds or milliseconds.
  if (value < 100000000000) {
    value *= 1000;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      short: "—",
      full: "Trade time unavailable"
    };
  }

  const options = {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  };

  const short = new Intl.DateTimeFormat("en-IN", options).format(date);

  const full = new Intl.DateTimeFormat("en-IN", {
    ...options,
    month: "long"
  }).format(date);

  return {
    short: `${short} IST`,
    full: `${full} IST`
  };
}

function renderTradeRow(trade, shmUsd) {
  const type = String(trade.type || "").toLowerCase();
  const isBuy = type === "buy";
  const actionClass = isBuy ? "buy" : "sell";
  const actionText = isBuy ? "🟢 BUY" : "🔴 SELL";

  const priceShm = Number(trade.price);
  const priceUsd =
    Number.isFinite(priceShm) && Number.isFinite(shmUsd)
      ? priceShm * shmUsd
      : NaN;

  const price = Number.isFinite(priceUsd)
    ? `$${priceUsd.toFixed(12)}`
    : "—";

  const name =
    trade.name ||
    trade.ticker ||
    "Unknown";

  const image =
    trade.image_url
      ? `<img
           src="${escapeAttribute(trade.image_url)}"
           class="trade-token-logo"
           onerror="this.style.display='none'"
         >`
      : "";

  const tradeDateTime = formatTradeDateTime(
    trade.timestamp || trade.t || trade.time
  );

  return `
    <div class="sikka-row">
      <div class="token-name">
        ${image}
        <span>${escapeHtml(name)}</span>
      </div>

      <div class="trade-action ${actionClass}">
        ${actionText}
      </div>

      <div class="trade-price">
        ${price}
      </div>

      <div class="trade-time" title="${escapeAttribute(tradeDateTime.full)}">
        ${escapeHtml(tradeDateTime.short)}
      </div>
    </div>
  `;
}

// --------------------------------------------------
// CHART
// --------------------------------------------------

async function loadSTMChart(timeframe = "24h") {
  const container = document.getElementById("stm-chart");
  if (!container) return;

  try {
    container.innerHTML =
      '<div class="chart-loading">Loading STM/USD market data...</div>';

    const [candleResponse, shmResponse] =
      await Promise.all([
        fetch(
          `/api/sikka-candles?timeframe=${encodeURIComponent(timeframe)}&limit=200&_=${Date.now()}`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/shm-price?_=${Date.now()}`,
          { cache: "no-store" }
        )
      ]);

    if (!candleResponse.ok) {
      throw new Error(`Candle API HTTP ${candleResponse.status}`);
    }

    if (!shmResponse.ok) {
      throw new Error(`SHM/USD API HTTP ${shmResponse.status}`);
    }

    const data = await candleResponse.json();
    const shmData = await shmResponse.json();

    if (
      !data.success ||
      !Array.isArray(data.candles) ||
      data.candles.length === 0
    ) {
      throw new Error("No candle data available");
    }

    const shmUsd = Number(shmData.priceUsd);

    if (!Number.isFinite(shmUsd) || shmUsd <= 0) {
      throw new Error("SHM/USD price unavailable");
    }

    if (stmChart) {
      try {
        stmChart.remove();
      } catch (_) {}
      stmChart = null;
      stmSeries = null;
    }

    container.innerHTML = "";

    const chartData = data.candles
      .map(candle => ({
        time: Number(candle.t),
        value: Number(candle.c) * shmUsd
      }))
      .filter(point =>
        Number.isFinite(point.time) &&
        Number.isFinite(point.value) &&
        point.value >= 0
      );

    if (!chartData.length) {
      throw new Error("Invalid STM/USD candle values");
    }

    const baselinePrice = chartData[0].value;

    stmChart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 430,

      layout: {
        background: { color: "transparent" },
        textColor: "#aaa"
      },

      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.05)" }
      },

      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.10)"
      },

      timeScale: {
        borderColor: "rgba(255,255,255,0.10)",
        timeVisible: true
      },

      localization: {
        priceFormatter: value =>
          "$" + Number(value).toFixed(9)
      }
    });

    stmSeries = stmChart.addSeries(
      LightweightCharts.BaselineSeries,
      {
        baseValue: {
          type: "price",
          price: baselinePrice
        },

        topLineColor: "#22c55e",
        topFillColor1: "rgba(34,197,94,0.30)",
        topFillColor2: "rgba(34,197,94,0.05)",

        bottomLineColor: "#ef4444",
        bottomFillColor1: "rgba(239,68,68,0.05)",
        bottomFillColor2: "rgba(239,68,68,0.30)",

        priceFormat: {
          type: "price",
          precision: 9,
          minMove: 0.000000001
        },

        lastValueVisible: true,
        priceLineVisible: true
      }
    );

    stmSeries.setData(chartData);
    stmChart.timeScale().fitContent();
  } catch (error) {
    console.error("STM/USD chart error:", error);

    container.innerHTML = `
      <div class="chart-error">
        Unable to load STM/USD market data.
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
  }
}

function resizeSTMChart() {
  const container = document.getElementById("stm-chart");

  if (stmChart && container) {
    stmChart.resize(
      container.clientWidth,
      window.innerWidth <= 700 ? 350 : 430
    );
  }
}

window.addEventListener("resize", resizeSTMChart);

document.querySelectorAll(".timeframe-button").forEach(button => {
  button.addEventListener("click", () => {
    const timeframe = button.dataset.timeframe;
    if (!timeframe) return;

    currentTimeframe = timeframe;

    document
      .querySelectorAll(".timeframe-button")
      .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");
    loadSTMChart(timeframe);
  });
});

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

// --------------------------------------------------
// INITIAL LOAD
// --------------------------------------------------

loadShantum();
loadSikkaTrades();
loadSTMChart("24h");

// Refresh live data every 60 seconds.
setInterval(() => {
  if (!isRefreshing) {
    loadShantum();
    loadSikkaTrades();
  }
}, 60 * 1000);
