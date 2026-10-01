/* Shantum Blockchain Activity - Explorer Style with Filters - FINAL */
(() => {
  if (window.__SHANTUM_BLOCKCHAIN_VIEW_LOADED__) {
    // Hot reload: remove old instance flag to allow replacement
    delete window.__SHANTUM_BLOCKCHAIN_VIEW_LOADED__;
  }
  window.__SHANTUM_BLOCKCHAIN_VIEW_LOADED__ = true;

  const BLOCKCHAIN_VIEW_MAX_ROWS = 20;
  const BLOCKCHAIN_VIEW_REFRESH_MS = 60000 // 60 sec refresh as requested;
  let blockchainViewRows = [];
  let blockchainViewLoading = false;
  let currentFilter = 'all';

  // === BLINK FOR NEW RECORDS (PRESERVED) ===
  let prevBlockchainTxSet = new Set();
  let newBlockchainBlinkMap = new Map();
  function isBlockchainBlinking(tx){
    const t = newBlockchainBlinkMap.get(String(tx||""));
    if(!t) return false;
    return (Date.now() - t) < 2000;
  }

  // === CSS - Explorer + Tabs + Blink ===
  (function injectBlockchainFinalCSS(){
    ['blockchain-blink-css','blockchain-explorer-css','blockchain-filter-css'].forEach(id=>{
      const e=document.getElementById(id); if(e) e.remove();
    });
    const s=document.createElement('style');
    s.id='blockchain-filter-css';
    s.textContent=`
      .bc-filter-bar{
        display:flex; gap:8px; flex-wrap:wrap; padding:12px 16px;
        background: rgba(24,26,36,0.9); border-bottom:1px solid rgba(255,255,255,0.08);
        position:sticky; top:0; z-index:2;
      }
      .bc-filter-btn{
        font-size:12px; font-weight:600; padding:6px 14px; border-radius:20px;
        border:1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
        color:#94a3b8; cursor:pointer; transition: all 0.2s ease; letter-spacing:0.2px;
      }
      .bc-filter-btn:hover{ background: rgba(255,255,255,0.1); color:#e2e8f0; border-color: rgba(255,255,255,0.2);}
      .bc-filter-btn.active{ background: rgba(24,227,154,0.18); color:#18e39a; border-color: rgba(24,227,154,0.4); box-shadow: 0 0 10px rgba(24,227,154,0.2);}
      .bc-filter-btn.active.coin{ background: rgba(249,115,22,0.18); color:#fb923c; border-color: rgba(249,115,22,0.35);}
      .bc-filter-btn.active.token{ background: rgba(139,92,246,0.18); color:#a78bfa; border-color: rgba(139,92,246,0.35);}
      .bc-filter-btn.active.staking{ background: rgba(34,197,94,0.18); color:#4ade80; border-color: rgba(34,197,94,0.35);}
      .bc-filter-btn.active.unstaking{ background: rgba(236,72,153,0.18); color:#f472b6; border-color: rgba(236,72,153,0.35);}
      .bc-filter-btn.active.claim{ background: rgba(59,130,246,0.18); color:#60a5fa; border-color: rgba(59,130,246,0.35);}
      .bc-filter-btn.active.burn{ background: rgba(239,68,68,0.18); color:#f87171; border-color: rgba(239,68,68,0.35);}
      .bc-filter-count{ font-size:10px; opacity:0.7; margin-left:4px; background: rgba(0,0,0,0.3); padding:1px 5px; border-radius:10px;}
      #blockchainBody .explorer-row{
        display:grid; grid-template-columns: 1.1fr 2.2fr 1.3fr; gap:12px; align-items:center;
        padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.06);
        background: rgba(18,20,28,0.85); transition: all 0.2s ease;
      }
      #blockchainBody .explorer-row:hover{ background: rgba(28,32,48,0.95); }
      #blockchainBody .explorer-row.new-blink{
        animation: blockchainBlink 2s ease-in-out 1;
        background: linear-gradient(90deg, rgba(24,227,154,0.28), rgba(22,143,241,0.15)) !important;
        border: 1px solid rgba(24,227,154,0.4) !important; box-shadow: 0 0 18px rgba(24,227,154,0.3);
      }
      @keyframes blockchainBlink{
        0%{background: rgba(24,227,154,0.6) !important; box-shadow: 0 0 25px rgba(24,227,154,0.65);}
        50%{background: rgba(24,227,154,0.25) !important;}
        100%{background: rgba(18,20,28,0.85); box-shadow: none;}
      }
      .exp-left{display:flex; flex-direction:column; gap:6px;}
      .exp-type{display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
      .exp-badge{ font-size:11px; font-weight:700; padding:3px 8px; border-radius:4px; letter-spacing:0.3px;}
      .exp-badge.token{background:rgba(139,92,246,0.18); color:#a78bfa; border:1px solid rgba(139,92,246,0.3);}
      .exp-badge.coin{background:rgba(249,115,22,0.18); color:#fb923c; border:1px solid rgba(249,115,22,0.3);}
      .exp-badge.staking{background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.3);}
      .exp-badge.claim{background:rgba(59,130,246,0.18); color:#60a5fa; border:1px solid rgba(59,130,246,0.3);}
      .exp-badge.unstaking{background:rgba(236,72,153,0.18); color:#f472b6; border:1px solid rgba(236,72,153,0.3);}
      .exp-badge.burn{background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.3);}
      .exp-badge.delegate{background:rgba(14,165,233,0.18); color:#38bdf8; border:1px solid rgba(14,165,233,0.3);}
      .exp-badge.contract{background:rgba(100,116,139,0.18); color:#94a3b8; border:1px solid rgba(100,116,139,0.3);}
      .exp-success{ font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.25); display:inline-flex; align-items:center; gap:3px;}
      .exp-txhash{ font-size:13px; color:#60a5fa; font-family: monospace; display:flex; align-items:center; gap:6px; cursor:pointer; text-decoration:none;}
      .exp-txhash:hover{color:#93c5fd; text-decoration:underline;}
      .exp-middle{display:flex; flex-direction:column; gap:8px;}
      .exp-transfer{ display:flex; align-items:center; gap:8px; font-size:13px; color:#cbd5e1; flex-wrap:wrap;}
      .exp-addr{ display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:6px; font-family:monospace; font-size:12px; color:#e2e8f0; max-width:150px; overflow:hidden; text-overflow:ellipsis;}
      .exp-addr .copy{opacity:0.5; cursor:pointer; font-size:11px;}
      .exp-addr .copy:hover{opacity:1;}
      .exp-time{font-size:11px; color:#64748b; margin-left:4px;}
      .exp-right{display:flex; flex-direction:column; gap:4px; text-align:right; align-items:flex-end;}
      .exp-value{font-size:13px; font-weight:600; color:#e2e8f0;}
      .exp-fee{font-size:11px; color:#94a3b8;}
      @media(max-width:900px){
        #blockchainBody .explorer-row{grid-template-columns:1fr; gap:10px;}
        .exp-right{text-align:left; align-items:flex-start;}
        .bc-filter-bar{overflow-x:auto; flex-wrap:nowrap; -webkit-overflow-scrolling:touch;}
      }
    `;
    document.head.appendChild(s);
  })();

  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }
  function shortAddr(v){ const s=String(v||""); return s.length>14 ? `${s.slice(0,6)}...${s.slice(-4)}` : (s||"Unknown"); }
  function shortTx(v){ const s=String(v||""); return s.length>22 ? `${s.slice(0,10)}...${s.slice(-6)}` : s; }
  function timeAgo(v){
    const d=v ? new Date(v) : null; if(!d || isNaN(d.getTime())) return "—";
    const diff=Date.now()-d.getTime(); const mins=Math.floor(diff/60000);
    if(mins<1) return "just now"; if(mins<60) return `${mins}m ago`;
    const hrs=Math.floor(mins/60); if(hrs<24) return `${hrs}h ago`;
    return d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata", day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit", hour12:true})+" IST";
  }
  function fullTime(v){
    const d=v ? new Date(v) : null; if(!d || isNaN(d.getTime())) return "";
    return d.toLocaleString("en-IN",{timeZone:"Asia/Kolkata", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true})+" IST";
  }
  function amountFmt(v){ const n=Number(v); if(!isFinite(n)) return "0"; return Math.floor(n).toLocaleString("en-US"); }

  function getTypeInfo(r){
    const t=String(r.type||"").toUpperCase();
    const m=String(r.methodRaw||r.method||"").toUpperCase();
    const methodRawLower = String(r.methodRaw||r.method||"").toLowerCase();
    // Order matters: check specific first
    if(t.includes("UNSTAK") || methodRawLower.includes("unstak") || methodRawLower.includes("undelegate")) return {key:"unstaking", label:"Unstaking", cls:"unstaking"};
    if(t.includes("BURN") || m.includes("BURN") || methodRawLower.includes("burn")) return {key:"burn", label:"Burn", cls:"burn"};
    if(t.includes("CLAIM") || methodRawLower.includes("claim") || methodRawLower.includes("withdraw") && m.includes("REWARD")) return {key:"claim", label:"Claim", cls:"claim"};
    if(m.includes("DELEGATE") || methodRawLower.includes("delegate") || t.includes("STAK")) return {key:"staking", label:"Staking", cls:"staking", sub: m.includes("DELEGATE") ? "Delegate" : "Staking"};
    if(t.includes("TOKEN")) return {key:"token", label:"Token transfer", cls:"token"};
    if(t.includes("COIN") || t==="TRANSFER") return {key:"coin", label:"Coin transfer", cls:"coin"};
    if(m.includes("DELEGATE")) return {key:"delegate", label:"Delegate", cls:"delegate"};
    return {key:"contract", label:"Contract", cls:"contract"};
  }

  function matchesFilter(r, filter){
    if(filter==='all') return true;
    const info=getTypeInfo(r);
    if(filter==='coin') return info.key==='coin';
    if(filter==='token') return info.key==='token';
    if(filter==='staking') return info.key==='staking' || info.key==='delegate';
    if(filter==='unstaking') return info.key==='unstaking';
    if(filter==='claim') return info.key==='claim';
    if(filter==='burn') return info.key==='burn';
    if(filter==='delegate') return info.key==='delegate' || info.key==='staking';
    return true;
  }

  function ensureFilterBar(){
    const body=document.getElementById("blockchainBody");
    if(!body) return;
    // Find parent container that holds body - insert filter bar before body
    if(document.getElementById("bc-filter-bar")) return;
    const bar=document.createElement("div");
    bar.id="bc-filter-bar";
    bar.className="bc-filter-bar";
    bar.innerHTML=`
      <button class="bc-filter-btn active" data-filter="all">All <span class="bc-filter-count" id="count-all">0</span></button>
      <button class="bc-filter-btn" data-filter="coin">Coin <span class="bc-filter-count" id="count-coin">0</span></button>
      <button class="bc-filter-btn" data-filter="token">Token <span class="bc-filter-count" id="count-token">0</span></button>
      <button class="bc-filter-btn staking" data-filter="staking">Staking/Delegate <span class="bc-filter-count" id="count-staking">0</span></button>
      <button class="bc-filter-btn unstaking" data-filter="unstaking">Unstaking <span class="bc-filter-count" id="count-unstaking">0</span></button>
      <button class="bc-filter-btn claim" data-filter="claim">Claim <span class="bc-filter-count" id="count-claim">0</span></button>
      <button class="bc-filter-btn burn" data-filter="burn">Burn <span class="bc-filter-count" id="count-burn">0</span></button>
    `;
    body.parentNode.insertBefore(bar, body);
    bar.querySelectorAll(".bc-filter-btn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        currentFilter=btn.dataset.filter;
        bar.querySelectorAll(".bc-filter-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        blockchainViewRender();
      });
    });
  }

  function updateFilterCounts(){
    const counts={all:blockchainViewRows.length, coin:0, token:0, staking:0, unstaking:0, claim:0, burn:0, delegate:0};
    for(const r of blockchainViewRows){
      const info=getTypeInfo(r);
      if(info.key==='coin') counts.coin++;
      if(info.key==='token') counts.token++;
      if(info.key==='staking' || info.key==='delegate') counts.staking++;
      if(info.key==='unstaking') counts.unstaking++;
      if(info.key==='claim') counts.claim++;
      if(info.key==='burn') counts.burn++;
    }
    const set=(id,val)=>{ const e=document.getElementById(id); if(e) e.textContent=String(val); };
    set("count-all", counts.all);
    set("count-coin", counts.coin);
    set("count-token", counts.token);
    set("count-staking", counts.staking);
    set("count-unstaking", counts.unstaking);
    set("count-claim", counts.claim);
    set("count-burn", counts.burn);
  }

  function blockchainViewRender(){
    const body=document.getElementById("blockchainBody");
    if(!body) return;
    ensureFilterBar();
    updateFilterCounts();

    let filtered = blockchainViewRows.filter(r=>matchesFilter(r, currentFilter));
    const rows = filtered.slice(0, BLOCKCHAIN_VIEW_MAX_ROWS);

    if(!rows.length){
      body.innerHTML = `<div class="whale-status">No ${currentFilter!=='all'? currentFilter : ''} activity found in latest ${blockchainViewRows.length} transactions. Try All tab.</div>`;
      return;
    }

    body.innerHTML = rows.map(r=>{
      const d=getTypeInfo(r);
      const fromFull=String(r.from||"");
      const toFull=String(r.to||"");
      const amount=amountFmt(r.amountShm);
      const ago=timeAgo(r.time);
      const fTime=fullTime(r.time);
      const txShort=shortTx(r.txHash);
      const href=r.txHash ? `https://explorer.shardeum.org/tx/${encodeURIComponent(r.txHash)}` : "https://explorer.shardeum.org/";
      const blinking=isBlockchainBlinking(r.txHash) ? ' new-blink' : '';
      const isZero=Number(r.amountShm)===0;
      const subLabel = r.methodRaw && r.methodRaw.startsWith('0x') ? esc(d.label) : esc(r.methodRaw || d.label);

      return `<div class="explorer-row${blinking}">
        <div class="exp-left">
          <div class="exp-type">
            <span class="exp-badge ${d.cls}">${esc(d.label)}</span>
            <span class="exp-success">✔ Success</span>
          </div>
          <a class="exp-txhash" href="${href}" target="_blank" rel="noopener noreferrer" title="${esc(r.txHash||'')}">
            <span>⇄</span> ${esc(txShort)} <span class="exp-time">${esc(ago)}</span>
          </a>
        </div>
        <div class="exp-middle">
          <div class="exp-transfer" title="From: ${esc(fromFull)}">
            <span>↓</span>
            <span class="exp-addr" title="${esc(fromFull)}">${esc(shortAddr(r.from))} <span class="copy" onclick="navigator.clipboard.writeText('${esc(fromFull)}')">⎙</span></span>
            <span>→</span>
            <span class="exp-addr" title="${esc(toFull)}">${esc(shortAddr(r.to))} <span class="copy" onclick="navigator.clipboard.writeText('${esc(toFull)}')">⎙</span></span>
          </div>
          <div class="exp-transfer" style="opacity:0.6; font-size:11px;">
            <span title="${esc(fTime)}">🕒 ${esc(fTime || ago)} • Block #${esc(String(r.block||''))}</span>
          </div>
        </div>
        <div class="exp-right">
          <div class="exp-value">${isZero ? 'Value 0 SHM' : `Value ${amount} SHM`}</div>
          <div class="exp-fee">${esc(subLabel)} • ${esc(d.sub||'Send')}</div>
        </div>
      </div>`;
    }).join("");
  }

  function blockchainViewSetLive(live, text){
    const el=document.getElementById("blockchainLive");
    const meta=document.getElementById("blockchainMeta");
    if(!el || !meta) return;
    el.innerHTML=`<i class="dot"></i> ${live ? "LIVE" : "OFFLINE"}`;
    el.style.color=live ? "#18e39a" : "#ff4d6d";
    el.style.borderColor=live ? "rgba(24,227,154,.35)" : "rgba(255,77,109,.35)";
    meta.textContent=text || "Monitoring Shardeum...";
  }

  async function loadBlockchainView(){
    if(blockchainViewLoading) return;
    blockchainViewLoading=true;
    const body=document.getElementById("blockchainBody");
    try{
      const response=await fetch(`/api/blockchain-activity?_=${Date.now()}`,{cache:"no-store", headers:{Accept:"application/json"}});
      const text=await response.text();
      let data; try{ data=JSON.parse(text); } catch{ throw new Error("Invalid JSON"); }
      if(!response.ok || !data.success) throw new Error(data?.error || "API error");

      const incoming=Array.isArray(data.activities) ? data.activities : [];
      const now=Date.now();
      for(const [tx,t] of newBlockchainBlinkMap){ if(now-t>3000) newBlockchainBlinkMap.delete(tx); }
      if(prevBlockchainTxSet.size>0){
        for(const r of incoming){
          const h=String(r.txHash||"");
          if(h && !prevBlockchainTxSet.has(h)) newBlockchainBlinkMap.set(h, now);
        }
      }
      prevBlockchainTxSet=new Set(incoming.map(r=>String(r.txHash||"")).filter(Boolean));
      blockchainViewRows=incoming;
      blockchainViewRender();
      if(newBlockchainBlinkMap.size>0){ setTimeout(()=>{ blockchainViewRender(); },2100); }

      const updated=data.updatedAt ? new Date(data.updatedAt) : new Date();
      const updatedText=isNaN(updated.getTime()) ? "" : updated.toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true})+" IST";
      blockchainViewSetLive(true, `${blockchainViewRows.length} txns • Block #${data.latestBlock||'—'} • Updated ${updatedText}`);
    }catch(error){
      console.error("Blockchain view error:", error);
      if(body && !body.innerHTML) body.innerHTML=`<div class="whale-status error">Unable to load blockchain activity. Retrying...</div>`;
      blockchainViewSetLive(false, "Retrying...");
    }finally{ blockchainViewLoading=false; }
  }

  loadBlockchainView();
  setInterval(loadBlockchainView, BLOCKCHAIN_VIEW_REFRESH_MS);

})();