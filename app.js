// ==================================================
// SHANTUM AI - app.js
// SIKKA MARKET TABLE: TOKEN | MCAP | PRICE | TXNS | VOLUME | TRADERS
// ==================================================

const shantumCard = document.getElementById("shantum-card");
const tradesCard = document.getElementById("sikka-trades-card");
const refreshButton = document.getElementById("refresh-button");

let isRefreshing = false;
let stmChart = null;
let stmSeries = null;

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function money(v) {
  const n = num(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function integer(v) {
  const n = num(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "—";
}

function price(v) {
  const n = num(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(6);
  return n.toFixed(10);
}

function attr(v) {
  return esc(v);
}

// ==================================================
// SHANTUM
// ==================================================

async function loadShantum() {
  if (!shantumCard) return;

  try {
    const [pRes, iRes, sRes] = await Promise.all([
      fetch(`/api/shantum-price?_=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/shantum?_=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/shm-price?_=${Date.now()}`, { cache: "no-store" })
    ]);

    if (!pRes.ok || !iRes.ok || !sRes.ok) {
      throw new Error("Unable to load Shantum data");
    }

    const p = await pRes.json();
    const info = await iRes.json();
    const shm = await sRes.json();

    const stmShm = num(p.price);
    const shmUsd = num(shm.priceUsd);
    const stmUsd = stmShm * shmUsd;
    const current = num(info.currentSupply);
    const max = num(info.maxSupply);
    const pct = max > 0 ? Math.min(100, Math.max(0, current / max * 100)) : 0;

    const contract =
      info.contractAddress || info.address || p.contractAddress || p.address || "";

    shantumCard.innerHTML = `
      <div class="coin-header">
        <img class="coin-logo" src="/shantumlogo.jpg"
             alt="STM"
             onerror="this.onerror=null;this.src='/shantum-logo.png';">
        <div>
          <h2>${esc(p.name || "Shantum")}</h2>
          <span>${esc(p.symbol || "STM")}</span>
        </div>
      </div>

      <div class="coin-price">
        $${Number.isFinite(stmUsd) ? stmUsd.toFixed(9) : "—"}
      </div>

      <div style="font-size:14px;opacity:.65;margin-top:-12px;margin-bottom:20px;">
        ${Number.isFinite(stmShm) ? stmShm.toFixed(9) : "—"} SHM
      </div>

      <div class="coin-info">
        <div>
          <small>Current Supply</small>
          <strong>${integer(current)} STM</strong>
        </div>
        <div>
          <small>Max Supply</small>
          <strong>${integer(max)} STM</strong>
        </div>
      </div>

      <div class="supply-section">
        <div class="supply-header">
          <span>Supply Progress</span>
          <strong>${pct.toFixed(2)}%</strong>
        </div>
        <div class="supply-bar">
          <div class="supply-fill" style="width:${pct}%"></div>
        </div>
      </div>

      ${contract ? `
        <div class="contract-section">
          <small>Contract Address</small>
          <div class="contract-row">
            <span class="contract-address" title="${attr(contract)}">${esc(contract)}</span>
            <button class="copy-button" type="button"
              data-address="${attr(contract)}" onclick="copyContract(this)">Copy</button>
          </div>
          <div class="copy-status" id="copy-status"></div>
        </div>` : ""}

      <a class="explorer-button interactive-button"
         href="${attr(p.explorer || "https://explorer.shardeum.org/")}"
         target="_blank" rel="noopener noreferrer">View Explorer ↗</a>

      <div class="social-links">
        <a href="https://t.me/shantumcoin" target="_blank" rel="noopener noreferrer"
           class="social-button telegram-button interactive-button">✈ Telegram</a>
        <a href="https://x.com/Shantumcoin" target="_blank" rel="noopener noreferrer"
           class="social-button x-button interactive-button">𝕏 X</a>
        <a href="https://join.sikka.fun/0ty8uzq" target="_blank" rel="noopener noreferrer"
           class="social-button trade-button interactive-button">↗ Trade</a>
      </div>
    `;
  } catch (e) {
    console.error("Shantum error:", e);
    shantumCard.innerHTML = `<div class="error">Unable to load Shantum data.</div>`;
  }
}

async function copyContract(button) {
  const address = button?.getAttribute("data-address");
  if (!address) return;
  try {
    await navigator.clipboard.writeText(address);
    button.innerText = "✓ Copied";
    setTimeout(() => button.innerText = "Copy", 2000);
  } catch (e) {
    console.error(e);
    button.innerText = "Copy failed";
  }
}
window.copyContract = copyContract;

// ==================================================
// SIKKA LIVE TRADES
// ==================================================

async function loadSikkaTrades() {
  if (!tradesCard) return;

  try {
    const response = await fetch(
      `/api/sikka-live-trades?_=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`Sikka API HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Sikka API error");
    }

    const tokens = Array.isArray(data.tokens)
      ? data.tokens
      : [];

    const trades = Array.isArray(data.trades)
      ? data.trades
      : [];

    const totalTradeCount = num(data.totalTradeCount);

    const today = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date());

    // Create a lookup so every individual BUY/SELL row
    // gets the market data belonging to that token.
    const tokenMap = {};

    tokens.forEach(token => {
      const address = String(
        token.token_ca ||
        token.contract ||
        token.address ||
        ""
      ).toLowerCase();

      if (address) {
        tokenMap[address] = token;
      }
    });

    // Every individual trade remains visible.
    // Newest trades appear first.
    trades.sort(
      (a, b) => getTradeTimestamp(b) - getTradeTimestamp(a)
    );

    tradesCard.innerHTML = `
      <div class="sikka-trades-card">

        <div class="sikka-title">
          <span>🔥</span>
          <span>LIVE SIKKA TRADES</span>
          <span class="live-dot"></span>
        </div>

        <div class="sikka-date">
          ${today}
        </div>

        <div class="sikka-stats">

          <div class="sikka-stat">
            <small>TOTAL TRADES</small>
            <strong>${integer(totalTradeCount)}</strong>
          </div>

          <div class="sikka-stat">
            <small>TOKENS</small>
            <strong>${integer(tokens.length)}</strong>
          </div>

        </div>

        <div class="sikka-market-table">

          <div class="sikka-market-header">
            <div>TOKEN</div>
            <div>ACTION</div>
            <div>PRICE</div>
            <div>TIME</div>
          </div>

          <div class="sikka-market-body">
            ${
              trades.length
                ? trades
                    .map(trade =>
                      renderIndividualTrade(
                        trade,
                        tokenMap
                      )
                    )
                    .join("")
                : `
                  <div class="sikka-empty">
                    No live trades available.
                  </div>
                `
            }
          </div>

        </div>

        <div class="sikka-updated">
          ● Live data from Sikka
        </div>

      </div>
    `;
  }
  catch (error) {
    console.error("Sikka error:", error);

    tradesCard.innerHTML = `
      <div class="sikka-trades-card">
        <div class="sikka-title">
          <span>🔥</span>
          <span>LIVE SIKKA TRADES</span>
        </div>

        <p style="color:#ff5264;">
          Unable to load Sikka trades.
        </p>

        <small style="color:#66758c;">
          ${esc(error.message)}
        </small>
      </div>
    `;
  }
}


// ==================================================
// INDIVIDUAL BUY / SELL ROW
// ==================================================

function renderIndividualTrade(
  trade,
  tokenMap
) {
  const tokenAddress = String(
    trade.token_ca ||
    trade.contract ||
    trade.address ||
    ""
  ).toLowerCase();

  const token = tokenMap[tokenAddress] || {};

  const name =
    trade.name ||
    token.name ||
    trade.ticker ||
    token.ticker ||
    "Unknown";

  const ticker =
    trade.ticker ||
    token.ticker ||
    token.symbol ||
    "";

  const logo =
    trade.image_url ||
    token.image_url ||
    token.image ||
    token.logo ||
    "";

  const image = logo
    ? `<img
         src="${attr(logo)}"
         class="trade-token-logo"
         onerror="this.style.display='none'"
       >`
    : "";

  const actionType = String(
    trade.type ||
    trade.side ||
    ""
  ).toLowerCase();

  const isBuy = actionType === "buy";

  const actionClass = isBuy
    ? "buy"
    : "sell";

  const actionText = isBuy
    ? "🟢 BUY"
    : "🔴 SELL";

  const tokenPrice = num(
    trade.priceUsd ??
    trade.price_usd ??
    trade.usdPrice ??
    trade.usd_price ??
    token.priceUsd ??
    token.price_usd ??
    token.usdPrice ??
    token.usd_price
  );

  const time = formatTradeTime(trade);

  return `
    <div class="sikka-market-row">

      <div class="sikka-market-token">
        ${image}

        <div class="sikka-market-token-text">
          <strong>${esc(name)}</strong>
          <span>${esc(ticker)}</span>
        </div>
      </div>

      <div class="sikka-market-action ${actionClass}">
        ${actionText}
      </div>

      <div class="sikka-market-value">
        ${Number.isFinite(tokenPrice)
          ? "$" + price(tokenPrice)
          : "—"}
      </div>

      <div class="sikka-market-time">
        ${esc(time)}
      </div>

    </div>
  `;
}


function getTradeTimestamp(trade) {
  let timestamp = Number(
    trade.timestamp ||
    trade.t ||
    trade.createdAt ||
    trade.created_at ||
    0
  );

  if (
    timestamp > 0 &&
    timestamp < 100000000000
  ) {
    timestamp *= 1000;
  }

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}


function formatTradeTime(trade) {
  const timestamp = getTradeTimestamp(trade);

  if (!timestamp) {
    return "—";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(date) + " IST"
  );
}

// ==================================================
// SIKKA TRADES CSS
// ==================================================

(function addMarketStyles() {
  if (document.getElementById("sikka-market-styles")) return;

  const style = document.createElement("style");
  style.id = "sikka-market-styles";

  style.textContent = `
    #shantum-card {
      grid-column: 1;
      grid-row: 1;
    }

    #sikka-trades-card {
      grid-column: 2;
      grid-row: 1;
      align-self: start;
      min-width: 0;
    }

    .sikka-trades-card {
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    .sikka-title {
      display: flex;
      align-items: center;
      gap: 9px;
      font-weight: 700;
      letter-spacing: .5px;
    }

    .sikka-date {
      margin: 6px 0 12px;
      color: #8ea1bd;
      font-size: 13px;
      font-weight: 600;
    }

    .sikka-stats {
      display: grid;
      grid-template-columns: repeat(2,minmax(0,1fr));
      gap: 10px;
      margin-bottom: 14px;
    }

    .sikka-stat {
      padding: 9px 12px;
      border: 1px solid rgba(0,170,255,.20);
      border-radius: 10px;
      background: rgba(0,20,45,.35);
    }

    .sikka-stat small {
      display: block;
      color: #7f91aa;
      font-size: 10px;
      letter-spacing: .6px;
      margin-bottom: 4px;
    }

    .sikka-stat strong {
      color: #eaf5ff;
      font-size: 16px;
    }

    .sikka-market-table {
      width: 100%;
      overflow-x: auto;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px;
      background: rgba(5,10,22,.45);
    }

    .sikka-market-header,
    .sikka-market-row {
      display: grid;
      grid-template-columns:
        minmax(180px,2.1fr)
        .95fr
        1.05fr
        1.15fr;
      min-width: 560px;
      align-items: center;
    }

    .sikka-market-header {
      padding: 10px 12px;
      background: rgba(255,255,255,.08);
      color: #dcecff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .4px;
      text-transform: uppercase;
    }

    .sikka-market-row {
      padding: 10px 12px;
      border-top: 1px solid rgba(255,255,255,.06);
    }

    .sikka-market-row:hover {
      background: rgba(0,150,255,.06);
    }

    .sikka-market-token {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }

    .sikka-market-token-text {
      min-width: 0;
    }

    .sikka-market-token-text strong {
      display: block;
      color: #eaf5ff;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sikka-market-token-text span {
      display: block;
      color: #7487a3;
      font-size: 10px;
      margin-top: 2px;
    }

    .sikka-market-value,
    .sikka-market-time {
      color: #dcecff;
      font-size: 12px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .sikka-market-time {
      color: #8ea1bd;
      font-size: 11px;
    }

    .sikka-market-action {
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
    }

    .sikka-market-action.buy {
      color: #37e58a;
    }

    .sikka-market-action.sell {
      color: #ff6070;
    }

    .trade-token-logo {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      flex: 0 0 28px;
    }

    .sikka-empty {
      padding: 25px;
      color: #8492aa;
      text-align: center;
    }

    .sikka-updated {
      margin-top: 10px;
      color: #62e89b;
      font-size: 10px;
    }

    @media (max-width:900px) {
      #shantum-card,
      #sikka-trades-card {
        grid-column: 1;
        grid-row: auto;
      }
    }
  `;

  document.head.appendChild(style);
})();

// ==================================================
// REFRESH
// ==================================================

async function refreshDashboard() {
  if (isRefreshing) return;
  isRefreshing = true;

  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.classList.add("refreshing");
    refreshButton.innerHTML = '<span class="refresh-icon">↻</span> Refreshing...';
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
      refreshButton.innerHTML = '<span class="refresh-icon">↻</span> Refresh Data';
    }
  }
}

if (refreshButton) {
  refreshButton.addEventListener("click", refreshDashboard);
}

loadShantum();
loadSikkaTrades();

// Refresh every 60 seconds.
setInterval(() => {
  if (!isRefreshing) {
    loadShantum();
    loadSikkaTrades();
  }
}, 60 * 1000);

// ==================================================
// STM/USD CHART
// ==================================================

async function loadSTMChart(timeframe = "24h") {
  const container = document.getElementById("stm-chart");
  if (!container || typeof LightweightCharts === "undefined") return;

  try {
    container.innerHTML = '<div class="chart-loading">Loading STM/USD market data...</div>';

    const [cRes, sRes] = await Promise.all([
      fetch(`/api/sikka-candles?timeframe=${encodeURIComponent(timeframe)}&limit=200&_=${Date.now()}`, { cache:"no-store" }),
      fetch(`/api/shm-price?_=${Date.now()}`, { cache:"no-store" })
    ]);

    if (!cRes.ok || !sRes.ok) throw new Error("Chart API unavailable");

    const data = await cRes.json();
    const shm = await sRes.json();
    const shmUsd = num(shm.priceUsd);

    if (!data.success || !Array.isArray(data.candles) || !data.candles.length) {
      throw new Error("No candle data available");
    }

    if (!Number.isFinite(shmUsd) || shmUsd <= 0) {
      throw new Error("SHM/USD price unavailable");
    }

    if (stmChart) stmChart.remove();

    container.innerHTML = "";

    const points = data.candles.map(c => ({
      time:Number(c.t),
      value:Number(c.c) * shmUsd
    })).filter(x => Number.isFinite(x.time) && Number.isFinite(x.value));

    if (!points.length) throw new Error("Invalid candle values");

    stmChart = LightweightCharts.createChart(container, {
      width:container.clientWidth,
      height:430,
      layout:{background:{color:"transparent"},textColor:"#aaa"},
      grid:{
        vertLines:{color:"rgba(255,255,255,.05)"},
        horzLines:{color:"rgba(255,255,255,.05)"}
      },
      rightPriceScale:{borderColor:"rgba(255,255,255,.10)"},
      timeScale:{borderColor:"rgba(255,255,255,.10)",timeVisible:true},
      localization:{priceFormatter:v=>"$"+Number(v).toFixed(9)}
    });

    stmSeries = stmChart.addSeries(LightweightCharts.BaselineSeries, {
      baseValue:{type:"price",price:points[0].value},
      topLineColor:"#22c55e",
      topFillColor1:"rgba(34,197,94,.30)",
      topFillColor2:"rgba(34,197,94,.05)",
      bottomLineColor:"#ef4444",
      bottomFillColor1:"rgba(239,68,68,.05)",
      bottomFillColor2:"rgba(239,68,68,.30)",
      priceFormat:{type:"price",precision:9,minMove:0.000000001}
    });

    stmSeries.setData(points);
    stmChart.timeScale().fitContent();
  } catch (e) {
    console.error("Chart error:",e);
    container.innerHTML = `<div class="chart-error">Unable to load STM/USD market data.<br><small>${esc(e.message)}</small></div>`;
  }
}

window.addEventListener("resize", () => {
  const c = document.getElementById("stm-chart");
  if (stmChart && c) stmChart.resize(c.clientWidth,430);
});

document.querySelectorAll(".timeframe-button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".timeframe-button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    loadSTMChart(button.dataset.timeframe || "24h");
  });
});

loadSTMChart("24h");
