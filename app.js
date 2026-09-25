// ==================================================
// SHANTUM AI - app.js
// SIKKA MARKET TABLE
// TOKEN | ACTION | MCAP | PRICE | TXNS | VOLUME | TRADERS | TIME
// ==================================================

const shantumCard = document.getElementById("shantum-card");
const tradesCard = document.getElementById("sikka-trades-card");
const refreshButton = document.getElementById("refresh-button");

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
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
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

    const tokens = Array.isArray(data.tokens) ? data.tokens : [];
    const trades = Array.isArray(data.trades) ? data.trades.slice(0, 30) : [];

    const tokenMap = {};

    tokens.forEach(token => {
      const address = String(
        token.token_ca || token.contract || token.address || ""
      ).toLowerCase();

      if (address) tokenMap[address] = token;
    });

    trades.sort(
      (a, b) => getTradeTimestamp(b) - getTradeTimestamp(a)
    );

    const today = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date());

    tradesCard.innerHTML = `
      <div class="sikka-trades-card">

        <div class="sikka-title">
          <span>🔥</span>
          <span>LIVE SIKKA TRADES</span>
          <span class="live-dot"></span>
        </div>

        <div class="sikka-date">${today}</div>

        <div class="sikka-stats">
          <div class="sikka-stat">
            <small>LAST 30 TRADES</small>
            <strong>${integer(trades.length)}</strong>
          </div>
          <div class="sikka-stat">
            <small>TOKENS</small>
            <strong>${integer(data.tokenCount ?? tokens.length)}</strong>
          </div>
        </div>

        <div class="sikka-market-table">
          <div class="sikka-market-header">
            <div>TOKEN</div>
            <div>ACTION</div>
            <div>MCAP</div>
            <div>PRICE</div>
            <div>TXNS</div>
            <div>VOLUME</div>
            <div>TRADERS</div>
            <div>TIME</div>
          </div>

          <div class="sikka-market-body">
            ${
              trades.length
                ? trades.map(t => renderIndividualTrade(t, tokenMap)).join("")
                : `<div class="sikka-empty">No live trades available.</div>`
            }
          </div>
        </div>

        <div class="sikka-updated">
          ● Latest 30 BUY/SELL trades · Sikka
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Sikka error:", error);
    tradesCard.innerHTML = `
      <div class="sikka-trades-card">
        <div class="sikka-title">
          <span>🔥</span>
          <span>LIVE SIKKA TRADES</span>
        </div>
        <p style="color:#ff5264;">Unable to load Sikka trades.</p>
        <small style="color:#66758c;">${esc(error.message)}</small>
      </div>
    `;
  }
}

function renderIndividualTrade(trade, tokenMap) {
  const address = String(trade.token_ca || "").toLowerCase();
  const token = tokenMap[address] || {};

  const name = trade.name || token.name || trade.ticker || token.ticker || "Unknown";
  const ticker = trade.ticker || token.ticker || token.symbol || "";

  const logo =
    trade.image_url ||
    token.image_url ||
    token.image ||
    token.logo ||
    "";

  const image = logo
    ? `<img src="${esc(logo)}" class="trade-token-logo"
         alt="${esc(ticker)}"
         onerror="this.style.display='none';">`
    : "";

  const action = String(trade.type || "").toLowerCase();
  const isBuy = action === "buy";

  // Backend returns these values already normalized to USD.
  const mcap = num(token.marketCapUsd);
  const tradePrice = num(trade.priceUsd);
  const tokenPrice = Number.isFinite(tradePrice)
    ? tradePrice
    : num(token.priceUsd);

  const txns = num(token.txns);
  const volume = Number.isFinite(num(trade.volumeUsd))
    ? num(trade.volumeUsd)
    : num(token.volumeUsd);

  const traders = num(token.traders);
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

      <div class="sikka-market-action ${isBuy ? "buy" : "sell"}">
        ${isBuy ? "🟢 BUY" : "🔴 SELL"}
      </div>

      <div class="sikka-market-value">${money(mcap)}</div>

      <div class="sikka-market-value">
        ${Number.isFinite(tokenPrice) ? "$" + price(tokenPrice) : "—"}
      </div>

      <div class="sikka-market-value">${integer(txns)}</div>

      <div class="sikka-market-value">${money(volume)}</div>

      <div class="sikka-market-value">${integer(traders)}</div>

      <div class="sikka-market-time">${esc(time)}</div>

    </div>
  `;
}

function getTradeTimestamp(trade) {
  let t = Number(
    trade?.timestamp ??
    trade?.t ??
    trade?.createdAt ??
    trade?.created_at ??
    trade?.date ??
    0
  );

  if (Number.isFinite(t) && t > 0 && t < 100000000000) {
    t *= 1000;
  }

  return Number.isFinite(t) ? t : 0;
}

function formatTradeTime(trade) {
  const timestamp = getTradeTimestamp(trade);
  if (!timestamp) return "—";

  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(d) + " IST";
}

// ==================================================
// TABLE CSS
// ==================================================

(function addSikkaStyles() {
  if (document.getElementById("sikka-market-styles")) return;

  const style = document.createElement("style");
  style.id = "sikka-market-styles";

  style.textContent = `
    #sikka-trades-card {
      min-width: 0;
    }

    .sikka-trades-card {
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    .sikka-title {
      display:flex;
      align-items:center;
      gap:9px;
      font-weight:700;
      letter-spacing:.5px;
    }

    .sikka-date {
      margin:6px 0 12px;
      color:#8ea1bd;
      font-size:13px;
      font-weight:600;
    }

    .sikka-stats {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
      margin-bottom:14px;
    }

    .sikka-stat {
      padding:9px 12px;
      border:1px solid rgba(0,170,255,.20);
      border-radius:10px;
      background:rgba(0,20,45,.35);
    }

    .sikka-stat small {
      display:block;
      color:#7f91aa;
      font-size:10px;
      letter-spacing:.6px;
      margin-bottom:4px;
    }

    .sikka-stat strong {
      color:#eaf5ff;
      font-size:16px;
    }

    .sikka-market-table {
      width:100%;
      overflow-x:auto;
      border:1px solid rgba(255,255,255,.08);
      border-radius:8px;
      background:rgba(5,10,22,.45);
    }

    .sikka-market-header,
    .sikka-market-row {
      display:grid;
      grid-template-columns:
        minmax(180px,2.1fr)
        .95fr
        1fr
        1.05fr
        .75fr
        1fr
        .9fr
        1.15fr;
      min-width:980px;
      align-items:center;
    }

    .sikka-market-header {
      padding:10px 12px;
      background:rgba(255,255,255,.08);
      color:#dcecff;
      font-size:10px;
      font-weight:800;
      letter-spacing:.4px;
    }

    .sikka-market-row {
      padding:10px 12px;
      border-top:1px solid rgba(255,255,255,.06);
    }

    .sikka-market-token {
      display:flex;
      align-items:center;
      gap:9px;
      min-width:0;
    }

    .sikka-market-token-text {
      min-width:0;
    }

    .sikka-market-token-text strong {
      display:block;
      color:#eaf5ff;
      font-size:13px;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .sikka-market-token-text span {
      display:block;
      color:#7487a3;
      font-size:10px;
      margin-top:2px;
    }

    .sikka-market-value,
    .sikka-market-time {
      color:#dcecff;
      font-size:12px;
      font-weight:600;
      font-variant-numeric:tabular-nums;
      white-space:nowrap;
    }

    .sikka-market-time {
      color:#8ea1bd;
      font-size:11px;
    }

    .sikka-market-action {
      font-size:12px;
      font-weight:800;
      white-space:nowrap;
    }

    .sikka-market-action.buy { color:#37e58a; }
    .sikka-market-action.sell { color:#ff6070; }

    .trade-token-logo {
      width:28px;
      height:28px;
      border-radius:50%;
      object-fit:cover;
      flex:0 0 28px;
    }

    .sikka-empty {
      padding:25px;
      color:#8492aa;
      text-align:center;
    }

    .sikka-updated {
      margin-top:10px;
      color:#62e89b;
      font-size:10px;
    }
  `;

  document.head.appendChild(style);
})();

// Refresh Sikka every 60 seconds.
loadSikkaTrades();
setInterval(loadSikkaTrades, 60 * 1000);
