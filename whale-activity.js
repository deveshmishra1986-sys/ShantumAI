/* Shantum Whale Activity - PREMIUM GOOD LOOKS - Buy/Sell >500k SHM - FINAL */
(() => {
  if (window.__SHANTUM_WHALE_ACTIVITY_LOADED__) {
    delete window.__SHANTUM_WHALE_ACTIVITY_LOADED__;
  }
  window.__SHANTUM_WHALE_ACTIVITY_LOADED__ = true;

  const WHALE_THRESHOLD_SHM = 500000;
  const WHALE_MAX_ROWS = 20;
  const WHALE_REFRESH_MS = 60000 // 60 sec refresh as requested;

  let whaleChainRows = [];
  let whaleTradeRows = [];
  let whaleLoading = false;
  let currentWhaleFilter = 'all'; // all, buy, sell

  let prevWhaleTxSet = new Set();
  let newWhaleBlinkMap = new Map();
  function isWhaleBlinking(tx){
    const t = newWhaleBlinkMap.get(String(tx||""));
    if(!t) return false;
    return (Date.now() - t) < 2000;
  }

  (function injectWhalePremiumCSS(){
    ['whale-blink-css','whale-premium-css'].forEach(id=>{ const e=document.getElementById(id); if(e) e.remove(); });
    const s=document.createElement('style');
    s.id='whale-premium-css';
    s.textContent=`
      #chainBody .whale-premium-row{
        display:grid; grid-template-columns: 1fr auto;
        gap:14px; padding:16px 18px; margin-bottom:10px;
        border-radius:14px; border:1px solid rgba(255,255,255,0.08);
        background: linear-gradient(135deg, rgba(22,24,36,0.95) 0%, rgba(18,20,32,0.9) 100%);
        position:relative; overflow:hidden; transition: all 0.25s ease;
      }
      #chainBody .whale-premium-row::before{
        content:''; position:absolute; left:0; top:0; bottom:0; width:4px;
      }
      #chainBody .whale-premium-row.buy::before{ background: linear-gradient(180deg, #18e39a, #0fb67a); }
      #chainBody .whale-premium-row.sell::before{ background: linear-gradient(180deg, #ff4d6d, #d9365a); }
      #chainBody .whale-premium-row.coin::before{ background: linear-gradient(180deg, #f59e0b, #d97706); }
      #chainBody .whale-premium-row:hover{
        transform: translateY(-2px); border-color: rgba(255,255,255,0.15);
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      }
      #chainBody .whale-premium-row.new-blink{
        animation: whalePremiumBlink 2s ease-in-out 1;
        border-color: rgba(24,227,154,0.5) !important;
        box-shadow: 0 0 28px rgba(24,227,154,0.4);
      }
      #chainBody .whale-premium-row.new-blink.sell{
        border-color: rgba(255,77,109,0.5) !important;
        box-shadow: 0 0 28px rgba(255,77,109,0.4);
      }
      @keyframes whalePremiumBlink{
        0%{background: rgba(24,227,154,0.45); transform: scale(1.02);}
        50%{background: rgba(24,227,154,0.15);}
        100%{background: linear-gradient(135deg, rgba(22,24,36,0.95) 0%, rgba(18,20,32,0.9) 100%); transform: scale(1);}
      }
      .whale-left{ display:flex; flex-direction:column; gap:8px; }
      .whale-top{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .whale-badge{
        font-size:11px; font-weight:800; padding:4px 10px; border-radius:20px; letter-spacing:0.5px; text-transform:uppercase;
        display:inline-flex; align-items:center; gap:5px;
      }
      .whale-badge.buy{ background: rgba(24,227,154,0.15); color:#18e39a; border:1px solid rgba(24,227,154,0.3);}
      .whale-badge.sell{ background: rgba(255,77,109,0.15); color:#ff4d6d; border:1px solid rgba(255,77,109,0.3);}
      .whale-badge.coin{ background: rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3);}
      .whale-addr{ font-family:monospace; font-size:13px; color:#e2e8f0; background: rgba(255,255,255,0.06); padding:4px 10px; border-radius:8px; display:inline-flex; align-items:center; gap:6px;}
      .whale-addr .copy{ opacity:0.6; cursor:pointer; }
      .whale-addr .copy:hover{ opacity:1; }
      .whale-main-text{
        font-size:15px; font-weight:600; color:#f1f5f9; line-height:1.4;
        display:flex; flex-wrap:wrap; gap:6px; align-items:center;
      }
      .whale-main-text .token{
        background: linear-gradient(90deg, #a78bfa, #60a5fa); -webkit-background-clip:text; -webkit-text-fill-color:transparent;
        font-weight:800; font-size:15px;
      }
      .whale-main-text .shm{
        color:#18e39a; font-weight:800;
      }
      .whale-main-text .shm.sell{ color:#ff4d6d; }
      .whale-meta{ display:flex; align-items:center; gap:12px; font-size:12px; color:#94a3b8; }
      .whale-meta .dot{ width:6px; height:6px; border-radius:50%; background:#64748b; display:inline-block; }
      .whale-right{ display:flex; flex-direction:column; align-items:flex-end; gap:8px; justify-content:center; }
      .whale-amount-big{ font-size:18px; font-weight:800; color:#f1f5f9; letter-spacing:-0.3px; }
      .whale-amount-big.buy{ color:#18e39a; } .whale-amount-big.sell{ color:#ff4d6d; }
      .whale-amount-sub{ font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
      .whale-explorer-btn{
        width:36px; height:36px; border-radius:10px; border:1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;
        color:#94a3b8; text-decoration:none; transition: all 0.2s;
      }
      .whale-explorer-btn:hover{ background: rgba(255,255,255,0.1); color:#e2e8f0; transform: rotate(15deg); }
      .whale-filter-bar{
        display:flex; gap:8px; padding:12px 0 14px; flex-wrap:wrap;
      }
      .whale-filter-btn{
        font-size:12px; font-weight:700; padding:6px 14px; border-radius:20px;
        border:1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
        color:#94a3b8; cursor:pointer; transition: all 0.2s;
      }
      .whale-filter-btn.active{ background: rgba(24,227,154,0.18); color:#18e39a; border-color: rgba(24,227,154,0.4); }
      .whale-filter-btn.active.sell{ background: rgba(255,77,109,0.18); color:#ff4d6d; border-color: rgba(255,77,109,0.35); }
      .whale-filter-btn.active.buy{ background: rgba(24,227,154,0.18); color:#18e39a; border-color: rgba(24,227,154,0.35); }
      @media(max-width:700px){
        #chainBody .whale-premium-row{ grid-template-columns:1fr; }
        .whale-right{ flex-direction:row; justify-content:space-between; align-items:center; }
      }
    `;
    document.head.appendChild(s);
  })();

  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
  function shortAddr(v){ const s=String(v||""); return s.length>18 ? `${s.slice(0,8)}...${s.slice(-6)}` : (s||"Unknown"); }
  function whole(v){ const n=Number(v); return isFinite(n) ? Math.floor(n).toLocaleString("en-US") : ""; }
  function whaleTimestamp(t){
    const value = t?.t ?? t?.timestamp ?? t?.time ?? t?.created_at ?? 0;
    const n = Number(value);
    if (isFinite(n) && n > 0) return new Date(n < 100000000000 ? n * 1000 : n);
    const parsed = Date.parse(String(value || ""));
    return isFinite(parsed) ? new Date(parsed) : null;
  }
  function whaleTimeAgo(t){
    const d = t instanceof Date ? t : whaleTimestamp(t);
    if(!d || isNaN(d.getTime())) return "—";
    const diff=Date.now()-d.getTime(); const mins=Math.floor(diff/60000);
    if(mins<1) return "just now"; if(mins<60) return `${mins}m ago`;
    const hrs=Math.floor(mins/60); if(hrs<24) return `${hrs}h ago`; const days=Math.floor(hrs/24); return `${days}d ago`;
  }
  function fullTimeStr(t){
    const d = t instanceof Date ? t : whaleTimestamp(t);
    if(!d || isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true})+" IST";
  }
  function tradeField(t, keys){ for(const k of keys){ const v=t?.[k]; if(v!==undefined && v!==null && v!=="" && isFinite(Number(v))) return Number(v); } return NaN; }
  function tradeAddr(t){ return t?.user || t?.wallet || t?.wallet_address || t?.walletAddress || t?.user_address || t?.trader || t?.from || t?.address || ""; }
  function tradeShm(t){ return tradeField(t, ["shm","shmAmount","shm_amount","amountShm","totalShm","quoteAmount","valueShm","spentShm","receivedShm","volumeShm"]); }
  function tradeQty(t){ return tradeField(t, ["amt","quantity","tokenQuantity","tokenAmount","amountToken","baseAmount","tokens","qty"]); }
  function tradeToken(t){ return String(t?.name || t?.symbol || t?.ticker || t?.tokenName || "TOKEN").toUpperCase(); }
  function txAddr(tx, key){
    if(!tx) return ""; if(key==="from") return tx.from?.hash || tx.from?.address || tx.from || tx.from_address || "";
    return tx.to?.hash || tx.to?.address || tx.to || tx.to_address || "";
  }

  function ensureWhaleFilter(){
    const body=document.getElementById("chainBody");
    if(!body) return;
    if(document.getElementById("whale-filter-bar")) return;
    const bar=document.createElement("div");
    bar.id="whale-filter-bar"; bar.className="whale-filter-bar";
    bar.innerHTML=`
      <button class="whale-filter-btn active" data-f="all">All Whales</button>
      <button class="whale-filter-btn buy" data-f="buy">🟢 Buys</button>
      <button class="whale-filter-btn sell" data-f="sell">🔴 Sells</button>
      <button class="whale-filter-btn" data-f="coin">💰 SHM Transfers</button>
    `;
    body.parentNode.insertBefore(bar, body);
    bar.querySelectorAll(".whale-filter-btn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        currentWhaleFilter=btn.dataset.f;
        bar.querySelectorAll(".whale-filter-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        renderWhaleActivity();
      });
    });
  }

  function whaleTradePremium(t){
    const type=String(t?.type||"").toLowerCase();
    if(type!=="buy" && type!=="sell") return null;
    const shm=tradeShm(t);
    if(!isFinite(shm) || shm <= WHALE_THRESHOLD_SHM) return null;
    const addrFull=tradeAddr(t);
    const addr=shortAddr(addrFull);
    if(!addr || addr==="Unknown") return null;
    const qty=tradeQty(t);
    const token=esc(tradeToken(t));
    const isBuy=type==="buy";
    const tx=String(t?.tx || t?.txHash || t?.transaction_hash || "");
    const href=tx ? `https://explorer.shardeum.org/tx/${encodeURIComponent(tx)}` : "https://explorer.shardeum.org/";
    const ago=whaleTimeAgo(t);
    const full=fullTimeStr(t);
    const blink=isWhaleBlinking(tx) ? ' new-blink' : '';

    const qtyText=isFinite(qty) ? `${whole(qty)}` : '';
    const shmText=whole(shm);

    return `<div class="whale-premium-row ${isBuy?'buy':'sell'}${blink}">
      <div class="whale-left">
        <div class="whale-top">
          <span class="whale-badge ${isBuy?'buy':'sell'}">${isBuy?'🟢 BUY':'🔴 SELL'}</span>
          <span class="whale-addr" title="${esc(addrFull)}">${esc(addr)} <span class="copy" onclick="navigator.clipboard.writeText('${esc(addrFull)}')">⎙</span></span>
          <span class="whale-meta"><span class="dot"></span> ${esc(ago)}</span>
        </div>
        <div class="whale-main-text" title="${esc(full)}">
          <span>${isBuy?'Bought':'Sold'}</span>
          ${qtyText ? `<span class="token">${qtyText} ${token}</span>` : `<span class="token">${token}</span>`}
          <span>for</span>
          <span class="shm ${isBuy?'':'sell'}">${shmText} SHM</span>
        </div>
        <div class="whale-meta">🕒 ${esc(full)} • Any token trade >500k SHM</div>
      </div>
      <div class="whale-right">
        <div style="text-align:right">
          <div class="whale-amount-big ${isBuy?'buy':'sell'}">${shmText} SHM</div>
          <div class="whale-amount-sub">${token} • ${isBuy?'Buy':'Sell'}</div>
        </div>
        <a class="whale-explorer-btn" href="${href}" target="_blank" rel="noopener noreferrer" title="View on explorer">↗</a>
      </div>
    </div>`;
  }

  function whaleNativePremium(r){
    const amount=Number(r?.amountShm);
    if(!isFinite(amount) || amount <= WHALE_THRESHOLD_SHM) return null;
    const fromFull=txAddr(r,"from") || r.from || "";
    const toFull=txAddr(r,"to") || r.to || "";
    const from=shortAddr(fromFull);
    const to=shortAddr(toFull);
    const time = r.time ? new Date(r.time) : null;
    const ago = time ? (()=>{ const diff=Date.now()-time.getTime(); const m=Math.floor(diff/60000); if(m<1) return "just now"; if(m<60) return `${m}m ago`; const h=Math.floor(m/60); if(h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`; })() : "—";
    const full = time && !isNaN(time.getTime()) ? time.toLocaleString("en-IN",{timeZone:"Asia/Kolkata", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true})+" IST" : "";
    const txUrl = r.txHash ? `https://explorer.shardeum.org/tx/${encodeURIComponent(r.txHash)}` : "https://explorer.shardeum.org/";
    const blink = isWhaleBlinking(r.txHash) ? ' new-blink' : '';

    return `<div class="whale-premium-row coin${blink}">
      <div class="whale-left">
        <div class="whale-top">
          <span class="whale-badge coin">💰 SHM TRANSFER</span>
          <span class="whale-addr" title="${esc(fromFull)}">${esc(from)} → ${esc(to)}</span>
          <span class="whale-meta"><span class="dot"></span> ${esc(ago)}</span>
        </div>
        <div class="whale-main-text">
          <span>Transferred</span>
          <span class="shm">${whole(amount)} SHM</span>
          <span>native</span>
        </div>
        <div class="whale-meta">🕒 ${esc(full)} • Large SHM transfer</div>
      </div>
      <div class="whale-right">
        <div style="text-align:right">
          <div class="whale-amount-big">${whole(amount)} SHM</div>
          <div class="whale-amount-sub">Native SHM</div>
        </div>
        <a class="whale-explorer-btn" href="${txUrl}" target="_blank" rel="noopener noreferrer">↗</a>
      </div>
    </div>`;
  }

  function whaleSetLive(live, text){
    const el=document.getElementById("chainLive");
    const meta=document.getElementById("chainMeta");
    if(!el || !meta) return;
    el.innerHTML=`<i class="dot"></i> ${live ? "LIVE" : "OFFLINE"}`;
    el.style.color=live ? "#18e39a" : "#ff4d6d";
    el.style.borderColor=live ? "rgba(24,227,154,.35)" : "rgba(255,77,109,.35)";
    meta.textContent=text || "Monitoring SHM whales >500k...";
  }

  function renderWhaleActivity(){
    const body=document.getElementById("chainBody");
    if(!body) return;
    ensureWhaleFilter();

    let tradeRows = whaleTradeRows.map(whaleTradePremium).filter(Boolean);
    let nativeRows = whaleChainRows.map(whaleNativePremium).filter(Boolean);

    // Apply filter
    if(currentWhaleFilter==='buy') tradeRows = tradeRows.filter(h=>h.includes('whale-premium-row buy'));
    if(currentWhaleFilter==='sell') tradeRows = tradeRows.filter(h=>h.includes('whale-premium-row sell'));
    if(currentWhaleFilter==='coin'){ tradeRows=[]; } // only coin
    if(currentWhaleFilter==='all'){ /* keep both */ }
    if(currentWhaleFilter!=='coin' && currentWhaleFilter!=='all' && currentWhaleFilter!=='buy' && currentWhaleFilter!=='sell'){
      // for coin filter, nativeRows only
    }

    let rows;
    if(currentWhaleFilter==='coin') rows = nativeRows;
    else if(currentWhaleFilter==='buy' || currentWhaleFilter==='sell') rows = tradeRows;
    else rows = [...tradeRows, ...nativeRows];

    rows = rows.slice(0, WHALE_MAX_ROWS);

    if(!rows.length){
      body.innerHTML=`<div class="whale-status">No whale trades >${(WHALE_THRESHOLD_SHM).toLocaleString()} SHM found. Waiting for big trades...</div>`;
      return;
    }
    body.innerHTML=rows.join("");
  }

  async function loadWhaleTradeFeed(){
    try{
      const res=await fetch(`/api/sikka-live-trades?_=${Date.now()}`,{cache:"no-store", headers:{Accept:"application/json"}});
      if(!res.ok) return;
      const data=await res.json();
      const incoming=Array.isArray(data?.trades) ? data.trades : [];
      // Blink detection for trades
      const now=Date.now();
      for(const [tx,t] of newWhaleBlinkMap){ if(now-t>3000) newWhaleBlinkMap.delete(tx); }
      if(prevWhaleTxSet.size>0){
        for(const r of incoming){
          const h=String(r?.tx || r?.txHash || r?.transaction_hash || r?.hash || "");
          if(h && !prevWhaleTxSet.has(h)) newWhaleBlinkMap.set(h, now);
        }
      }
      // Update set only for trade hashes (keep chain hashes too)
      const newSet=new Set([...prevWhaleTxSet]);
      incoming.forEach(r=>{ const h=String(r?.tx || r?.txHash || ""); if(h) newSet.add(h); });
      prevWhaleTxSet=newSet;
      whaleTradeRows=incoming;
      renderWhaleActivity();
      if(newWhaleBlinkMap.size>0) setTimeout(()=>renderWhaleActivity(),2100);
    }catch(e){ console.warn("Whale trade feed unavailable:", e?.message || e); }
  }

  async function loadWhaleBlockchainFeed(){
    if(whaleLoading) return;
    whaleLoading=true;
    const body=document.getElementById("chainBody");
    const hadRows=whaleChainRows.length>0;
    let timeout;
    try{
      const controller=new AbortController();
      timeout=setTimeout(()=>controller.abort(),25000);
      const res=await fetch(`/api/blockchain-activity?_=${Date.now()}`,{method:"GET", cache:"no-store", headers:{Accept:"application/json"}, signal:controller.signal});
      clearTimeout(timeout);
      const text=await res.text();
      let data; try{ data=JSON.parse(text); } catch{ throw new Error("Invalid JSON"); }
      if(!res.ok || !data.success) throw new Error(data?.error || "API error");

      const incomingWhale=Array.isArray(data.activities) ? data.activities : [];
      const nowW=Date.now();
      for(const [tx,t] of newWhaleBlinkMap){ if(nowW-t>3000) newWhaleBlinkMap.delete(tx); }
      if(prevWhaleTxSet.size>0){
        for(const r of incomingWhale){
          const h=String(r.txHash||"");
          if(h && !prevWhaleTxSet.has(h)) newWhaleBlinkMap.set(h, nowW);
        }
      }
      const newSet=new Set([...prevWhaleTxSet]);
      incomingWhale.forEach(r=>{ const h=String(r.txHash||""); if(h) newSet.add(h); });
      prevWhaleTxSet=newSet;
      whaleChainRows=incomingWhale;
      renderWhaleActivity();
      if(newWhaleBlinkMap.size>0) setTimeout(()=>renderWhaleActivity(),2100);

      const updated=data.updatedAt ? new Date(data.updatedAt) : new Date();
      const updatedText=isNaN(updated.getTime()) ? "" : `Updated ${updated.toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true})} IST`;
      const qualifying=whaleChainRows.filter(r=>{ const n=Number(r?.amountShm); return isFinite(n) && n>WHALE_THRESHOLD_SHM; }).length + whaleTradeRows.filter(t=>{ const n=tradeShm(t); return isFinite(n) && n>WHALE_THRESHOLD_SHM; }).length;
      whaleSetLive(true, qualifying ? `${qualifying} whales >500k SHM • ${updatedText}` : `Scanning whales >500k SHM • ${updatedText}`);
    }catch(error){
      const isAbort=error?.name==='AbortError' || String(error?.message||'').includes('aborted');
      if(isAbort) console.warn("Whale feed slow, retrying");
      else console.error("Whale blockchain feed error:", error);
      if(!hadRows && body) body.innerHTML='<div class="whale-status">Loading whale activity... (Shardeum slow, retrying)</div>';
      whaleSetLive(hadRows, hadRows ? "Last data shown • retrying in 20s" : "Retrying in 20s...");
    }finally{ if(typeof timeout!=='undefined') clearTimeout(timeout); whaleLoading=false; }
  }

  function startWhaleActivity(){
    loadWhaleTradeFeed();
    loadWhaleBlockchainFeed();
    setInterval(()=>{ loadWhaleTradeFeed(); loadWhaleBlockchainFeed(); }, WHALE_REFRESH_MS);
  }
  startWhaleActivity();

})();