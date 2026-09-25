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
    // Do NOT let SHM/USD failure block the Shantum card.
    const [pRes, iRes, sRes] = await Promise.allSettled([
      fetch(`/api/shantum-price?_=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/shantum?_=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/shm-price?_=${Date.now()}`, { cache: "no-store" })
    ]);

    let p = {};
    let info = {};
    let shm = {};

    if (pRes.status === "fulfilled" && pRes.value.ok) {
      try { p = await pRes.value.json(); } catch (_) {}
    }

    if (iRes.status === "fulfilled" && iRes.value.ok) {
      try { info = await iRes.value.json(); } catch (_) {}
    }

    if (sRes.status === "fulfilled" && sRes.value.ok) {
      try { shm = await sRes.value.json(); } catch (_) {}
    }

    const stmShm = num(p.price);
    const shmUsd = num(shm.priceUsd);
    const stmUsd = Number.isFinite(stmShm) && Number.isFinite(shmUsd)
      ? stmShm * shmUsd
      : NaN;

    const current = num(info.currentSupply);
    const max = num(info.maxSupply);
    const pct = Number.isFinite(max) && max > 0 && Number.isFinite(current)
      ? Math.min(100, Math.max(0, current / max * 100))
      : 0;

    const contract =
      info.contractAddress || info.address ||
      p.contractAddress || p.address ||
      "0x3Fe5fbBA8034762fDd8d3d3b3dD7E788B9a12F04";

    const name = p.name || info.name || "Shantum";
    const symbol = p.symbol || info.symbol || "STM";
    const explorer = p.explorer ||
      `https://explorer.shardeum.org/address/${contract}`;

    shantumCard.innerHTML = `
      <div class="coin-header">
        <img class="coin-logo" src="/shantumlogo.jpg"
             alt="STM"
             onerror="this.onerror=null;this.src='/shantum-logo.png';">
        <div>
          <h2>${esc(name)}</h2>
          <span>${esc(symbol)}</span>
        </div>
      </div>

      <div class="coin-price">
        ${Number.isFinite(stmUsd) ? "$" + stmUsd.toFixed(9) :
          (Number.isFinite(stmShm) ? stmShm.toFixed(9) + " SHM" : "—")}
      </div>

      <div style="font-size:14px;opacity:.65;margin-top:-12px;margin-bottom:20px;">
        ${Number.isFinite(stmShm) ? stmShm.toFixed(9) + " SHM" : "Price unavailable"}
        ${Number.isFinite(shmUsd) ? " · SHM $" + shmUsd.toFixed(6) : ""}
      </div>

      <div class="coin-info">
        <div>
          <small>Current Supply</small>
          <strong>${Number.isFinite(current) ? integer(current) + " STM" : "—"}</strong>
        </div>
        <div>
          <small>Max Supply</small>
          <strong>${Number.isFinite(max) ? integer(max) + " STM" : "1,000,000,000 STM"}</strong>
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

      <div class="contract-section">
        <small>Contract Address</small>
        <div class="contract-row">
          <span class="contract-address" title="${attr(contract)}">${esc(contract)}</span>
          <button class="copy-button" type="button"
            data-address="${attr(contract)}" onclick="copyContract(this)">Copy</button>
        </div>
        <div class="copy-status" id="copy-status"></div>
      </div>

      <a class="explorer-button interactive-button"
         href="${attr(explorer)}"
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
    shantumCard.innerHTML = `<div class="error">Unable to load Shantum data.<br><small>${esc(e.message)}</small></div>`;
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
            <div>TXNS</div>
         
    <!--   <div>VOLUME</div>
     <div>MCAP</div>
            <div>TRADERS</div>-->
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

  const mcap = num(
    token.marketCapUsd ??
    token.market_cap_usd ??
    token.marketCapUSD ??
    token.marketCap
  );

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

  const txns = num(
    token.txns ??
    token.transactions ??
    token.totalTransactions ??
    token.totalTrades ??
    token.total_trades ??
    token.tradeCount ??
    token.trade_count
  );

  const volume = num(
    trade.volumeUsd ??
    trade.volume_usd ??
    trade.usdVolume ??
    trade.usd_volume ??
    trade.tradeValueUsd ??
    trade.trade_value_usd ??
    token.volumeUsd ??
    token.volume_usd ??
    token.totalVolumeUsd ??
    token.total_volume_usd
  );

  const traders = num(
    token.traders ??
    token.uniqueTraders ??
    token.unique_traders ??
    token.traderCount ??
    token.trader_count ??
    token.holdersTraded
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
        ${money(mcap)}
      </div>

      <div class="sikka-market-value">
        ${Number.isFinite(tokenPrice)
          ? "$" + price(tokenPrice)
          : "—"}
      </div>

      <div class="sikka-market-value">
        ${integer(txns)}
      </div>

      <div class="sikka-market-value">
        ${money(volume)}
      </div>

      <div class="sikka-market-value">
        ${integer(traders)}
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
        1fr
        1.05fr
        .75fr
        1fr
        .9fr
        1.15fr;
      min-width: 980px;
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
// STM CHART - NO EXTERNAL CHART LIBRARY REQUIRED
// ==================================================

let currentTimeframe = "24h";

async function loadSTMChart(timeframe = "24h") {
  const container = document.getElementById("stm-chart");
  if (!container) return;

  currentTimeframe = timeframe;
  container.innerHTML = '<div class="chart-loading">Loading STM market data...</div>';

  try {
    const [cRes, sRes] = await Promise.allSettled([
      fetch(`/api/sikka-candles?timeframe=${encodeURIComponent(timeframe)}&limit=200&_=${Date.now()}`, { cache: "no-store" }),
      fetch(`/api/shm-price?_=${Date.now()}`, { cache: "no-store" })
    ]);

    if (cRes.status !== "fulfilled" || !cRes.value.ok) {
      throw new Error("Candle API unavailable");
    }

    const data = await cRes.value.json();
    if (!data.success || !Array.isArray(data.candles) || !data.candles.length) {
      throw new Error(data.error || "No candle data available");
    }

    let shmUsd = NaN;
    if (sRes.status === "fulfilled" && sRes.value.ok) {
      try {
        const shm = await sRes.value.json();
        shmUsd = num(shm.priceUsd);
      } catch (_) {}
    }

    const raw = data.candles.map(c => ({
      time: Number(c.t),
      shm: Number(c.c)
    })).filter(x => Number.isFinite(x.time) && Number.isFinite(x.shm));

    if (!raw.length) throw new Error("Invalid candle values");

    // If SHM/USD is available show USD. Otherwise show STM/SHM.
    const useUsd = Number.isFinite(shmUsd) && shmUsd > 0;
    const points = raw.map(x => ({
      time: x.time,
      value: useUsd ? x.shm * shmUsd : x.shm
    }));

    const values = points.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || Math.max(Math.abs(max) * 0.01, 0.000000001);

    const width = 1200;
    const height = 390;
    const padL = 70;
    const padR = 25;
    const padT = 25;
    const padB = 48;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const x = i => padL + (points.length <= 1 ? 0 : i / (points.length - 1)) * plotW;
    const y = v => padT + (1 - (v - min) / range) * plotH;

    const line = points.map((p,i) => `${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
    const area = `${padL},${height-padB} ${line} ${x(points.length-1)},${height-padB}`;

    const grid = [];
    for (let i=0;i<=4;i++) {
      const yy = padT + i * plotH / 4;
      const val = max - i * range / 4;
      grid.push(`
        <line x1="${padL}" y1="${yy}" x2="${width-padR}" y2="${yy}" stroke="rgba(255,255,255,.07)"/>
        <text x="${padL-10}" y="${yy+4}" text-anchor="end" fill="#8794a8" font-size="11">${useUsd ? "$" + val.toFixed(9) : val.toFixed(9) + " SHM"}</text>
      `);
    }

    const start = new Date(points[0].time * 1000);
    const end = new Date(points[points.length-1].time * 1000);
    const fmt = d => new Intl.DateTimeFormat("en-IN", {
      timeZone:"Asia/Kolkata", hour:"2-digit", minute:"2-digit", hour12:true
    }).format(d);

    container.innerHTML = `
      <div style="height:100%;width:100%;position:relative;">
        <div style="position:absolute;left:12px;top:8px;z-index:2;color:#8ea1bd;font-size:12px;font-weight:700;">
          ${useUsd ? "STM / USD" : "STM / SHM"}
        </div>
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;">
          <defs>
            <linearGradient id="stmArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#22c55e" stop-opacity=".28"/>
              <stop offset="100%" stop-color="#22c55e" stop-opacity=".02"/>
            </linearGradient>
          </defs>
          ${grid.join("")}
          <polygon points="${area}" fill="url(#stmArea)"/>
          <polyline points="${line}" fill="none" stroke="#22c55e" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
          <text x="${padL}" y="${height-16}" fill="#8794a8" font-size="11">${fmt(start)} IST</text>
          <text x="${width-padR}" y="${height-16}" text-anchor="end" fill="#8794a8" font-size="11">${fmt(end)} IST</text>
        </svg>
      </div>
    `;
  } catch (e) {
    console.error("Chart error:", e);
    container.innerHTML = `<div class="chart-error">Unable to load STM market data.<br><small>${esc(e.message)}</small></div>`;
  }
}

document.querySelectorAll(".timeframe-button").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".timeframe-button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    loadSTMChart(button.dataset.timeframe || "24h");
  });
});

loadSTMChart("24h");
