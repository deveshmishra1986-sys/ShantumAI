const state = {
  allTrades: [],
  filteredTrades: [],
  tokens: [],
  page: 1,
  pageSize: 10,
  shmUsd: 0,
  loading: false
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function numberString(value, max = 12) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-IN", { maximumFractionDigits: max });
}

function priceString(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (n === 0) return "$0";
  return "$" + n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 12
  });
}

function timeMs(trade) {
  const t = Number(trade?.t ?? trade?.timestamp);
  if (!Number.isFinite(t)) return 0;
  return t < 100000000000 ? t * 1000 : t;
}

function formatTime(trade) {
  const ms = timeMs(trade);
  if (!ms) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(new Date(ms)) + " IST";
}

function formatDate() {
  const now = new Date();
  $("currentDate").textContent = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day:"2-digit", month:"short", year:"numeric"
  }).format(now);
  $("currentTime").textContent = new Intl.DateTimeFormat("en-IN", {
    timeZone:"Asia/Kolkata", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true
  }).format(now) + " IST";
}
setInterval(formatDate, 1000);
formatDate();

async function getJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Invalid JSON from ${url}`); }
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data;
}

async function loadTrades() {
  if (state.loading) return;
  state.loading = true;
  $("status").className = "status";
  $("status").textContent = "Loading latest Sikka trades...";

  try {
    const [tradeResult, shmResult] = await Promise.all([
      getJson("/api/sikka-live-trades"),
      getJson("/api/shm-price").catch(() => ({ priceUsd: 0 }))
    ]);

    if (!tradeResult.success) throw new Error(tradeResult.error || "Unable to load trades");

    state.allTrades = Array.isArray(tradeResult.trades) ? tradeResult.trades : [];
    state.tokens = Array.isArray(tradeResult.tokens) ? tradeResult.tokens : [];
    state.shmUsd = Number(shmResult?.priceUsd || shmResult?.price_usd || 0);

    state.allTrades.sort((a,b) => timeMs(b) - timeMs(a));
    state.page = 1;

    populateTokenFilter();
    applyFilters();

    $("status").textContent =
      `Updated ${new Date().toLocaleTimeString("en-IN")} • ${state.allTrades.length} trades loaded from ${state.tokens.length} tokens`;
  } catch (err) {
    console.error(err);
    $("status").className = "status error";
    $("status").textContent = "Unable to load Sikka trades: " + err.message;
  } finally {
    state.loading = false;
  }
}

function populateTokenFilter() {
  const select = $("tokenFilter");
  const current = select.value;
  const unique = new Map();

  state.tokens.forEach(t => {
    const ca = String(t.token_ca || "").toLowerCase();
    if (ca) unique.set(ca, t);
  });

  state.allTrades.forEach(t => {
    const ca = String(t.token_ca || t.tokenCa || "").toLowerCase();
    if (ca && !unique.has(ca)) {
      unique.set(ca, {
        token_ca: ca,
        name: t.name || "Unknown",
        ticker: t.ticker || t.symbol || ""
      });
    }
  });

  select.innerHTML = '<option value="all">All Tokens</option>';
  [...unique.values()]
    .sort((a,b) => String(a.name||"").localeCompare(String(b.name||"")))
    .forEach(t => {
      const option = document.createElement("option");
      option.value = String(t.token_ca).toLowerCase();
      option.textContent = `${t.name || "Unknown"}${t.ticker ? " (" + t.ticker + ")" : ""}`;
      select.appendChild(option);
    });

  if ([...select.options].some(o => o.value === current)) select.value = current;
}

function applyFilters() {
  const search = $("searchInput").value.trim().toLowerCase();
  const token = $("tokenFilter").value;
  const action = $("actionFilter").value;
  const period = $("timeFilter").value;
  const now = Date.now();
  const hours = period === "1h" ? 1 : period === "6h" ? 6 : period === "24h" ? 24 : 0;

  state.filteredTrades = state.allTrades.filter(t => {
    const name = String(t.name || t.token_name || "").toLowerCase();
    const symbol = String(t.ticker || t.symbol || "").toLowerCase();
    const ca = String(t.token_ca || t.tokenCa || "").toLowerCase();
    const type = String(t.type || "").toLowerCase();

    if (search && !name.includes(search) && !symbol.includes(search)) return false;
    if (token !== "all" && ca !== token) return false;
    if (action !== "all" && type !== action) return false;
    if (hours && now - timeMs(t) > hours * 3600000) return false;
    return true;
  });

  state.page = Math.min(state.page, Math.max(1, Math.ceil(state.filteredTrades.length / state.pageSize)));
  render();
}

function render() {
  const trades = state.filteredTrades;
  const buys = trades.filter(t => String(t.type).toLowerCase() === "buy").length;
  const sells = trades.filter(t => String(t.type).toLowerCase() === "sell").length;

  $("tradeCount").textContent = trades.length.toLocaleString("en-IN");
  $("tokenCount").textContent = state.tokens.length.toLocaleString("en-IN");
  $("buyCount").textContent = buys.toLocaleString("en-IN");
  $("sellCount").textContent = sells.toLocaleString("en-IN");
  $("buyPercent").textContent = trades.length ? `${(buys/trades.length*100).toFixed(1)}% of loaded trades` : "0% of loaded trades";
  $("sellPercent").textContent = trades.length ? `${(sells/trades.length*100).toFixed(1)}% of loaded trades` : "0% of loaded trades";

  const start = (state.page - 1) * state.pageSize;
  const pageTrades = trades.slice(start, start + state.pageSize);

  $("tradeBody").innerHTML = pageTrades.map((t, i) => {
    const type = String(t.type || "").toLowerCase();
    const name = t.name || t.token_name || "Unknown";
    const symbol = t.ticker || t.symbol || "";
    const ca = String(t.token_ca || t.tokenCa || "").toLowerCase();
    const priceShm = Number(t.price);
    const priceUsd = Number.isFinite(priceShm) && state.shmUsd ? priceShm * state.shmUsd : 0;
    const image = t.image_url || "/shantum-logo.png";

    return `<tr>
      <td>${start+i+1}</td>
      <td>
        <div class="token-cell">
          <img src="${escapeHtml(image)}" alt="" onerror="this.style.display='none'">
          <div><div class="token-name">${escapeHtml(name)}</div><div class="token-ca">${escapeHtml(ca.slice(0,8))}${ca ? "..." : ""}</div></div>
        </div>
      </td>
      <td>${escapeHtml(symbol)}</td>
      <td><span class="action ${type === "sell" ? "sell" : "buy"}">${type === "sell" ? "SELL" : "BUY"}</span></td>
      <td class="price-usd">${priceUsd ? priceString(priceUsd) : "-"}</td>
      <td class="price-shm">${Number.isFinite(priceShm) ? priceShm.toLocaleString("en-US",{maximumFractionDigits:12}) : "-"}</td>
      <td class="amount">${numberString(t.shm,8)} SHM</td>
      <td class="amount">${numberString(t.amt,8)}</td>
      <td class="time">${formatTime(t)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="9" style="text-align:center;padding:35px">No trades found.</td></tr>`;

  $("showingText").textContent =
    `Showing ${trades.length ? start+1 : 0} - ${Math.min(start+pageTrades.length, trades.length)} of ${trades.length.toLocaleString("en-IN")} loaded trades`;

  renderPagination();
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.filteredTrades.length / state.pageSize));
  const box = $("pageNumbers");
  box.innerHTML = "";

  const pages = [];
  for (let p=1; p<=totalPages; p++) {
    if (p <= 5 || p === totalPages || Math.abs(p-state.page) <= 1) pages.push(p);
  }

  let previous = 0;
  pages.forEach(p => {
    if (previous && p - previous > 1) {
      const dots = document.createElement("span");
      dots.textContent = "...";
      dots.style.padding = "0 5px";
      box.appendChild(dots);
    }
    const b = document.createElement("button");
    b.className = "page-btn" + (p === state.page ? " active" : "");
    b.textContent = p;
    b.onclick = () => { state.page = p; render(); };
    box.appendChild(b);
    previous = p;
  });

  $("prevBtn").disabled = state.page <= 1;
  $("nextBtn").disabled = state.page >= totalPages;
}

$("prevBtn").onclick = () => { if (state.page > 1) { state.page--; render(); } };
$("nextBtn").onclick = () => {
  const max = Math.max(1, Math.ceil(state.filteredTrades.length / state.pageSize));
  if (state.page < max) { state.page++; render(); }
};
$("refreshBtn").onclick = loadTrades;
$("searchInput").oninput = () => { state.page=1; applyFilters(); };
$("tokenFilter").onchange = () => { state.page=1; applyFilters(); };
$("actionFilter").onchange = () => { state.page=1; applyFilters(); };
$("timeFilter").onchange = () => { state.page=1; applyFilters(); };

$("chartBtn").onclick = () => $("chartModal").classList.remove("hidden");
$("closeChart").onclick = () => $("chartModal").classList.add("hidden");
$("chartModal").onclick = e => { if (e.target.id === "chartModal") $("chartModal").classList.add("hidden"); };

// Sikka's documentation recommends responsible polling and says to sync/cache rather
// than live-proxy. This dashboard therefore refreshes the collected feed every 60s.
setInterval(() => {
  if (!state.loading) loadTrades();
}, 60 * 1000);

loadTrades();
