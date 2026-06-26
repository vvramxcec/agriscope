// ═══════════════════════════════════════════════════════
//  COMMODITY PRICE ENGINE
//  MARKET PRICE SIMULATION
//  Self-contained — no dependency on weather/crop/disease/flood data
//  Depends on: buildChart(), currentChartType (from inline script)
// ═══════════════════════════════════════════════════════
const COMMODITIES = [
  { id:'coconut',     emoji:'🥥', name:'Coconut',       unit:'₹/100 nuts', mandi:'Kochi',           base:2840, vol:0.008, crop:'Coconut' },
  { id:'pepper',      emoji:'🌿', name:'Black Pepper',  unit:'₹/kg',       mandi:'Kochi',           base:545,  vol:0.012, crop:'Pepper' },
  { id:'cardamom',    emoji:'💚', name:'Cardamom',      unit:'₹/kg',       mandi:'Kumily',          base:1480, vol:0.030, crop:'Cardamom' },
  { id:'rubber',      emoji:'🌳', name:'Rubber RSS4',   unit:'₹/kg',       mandi:'Kottayam',        base:218,  vol:0.010, crop:'Rubber' },
  { id:'coffee',      emoji:'☕', name:'Coffee Robusta',unit:'₹/kg',       mandi:'Wayanad',         base:165,  vol:0.015, crop:'Coffee' },
  { id:'tea',         emoji:'🍵', name:'Tea',           unit:'₹/kg',       mandi:'Munnar',          base:92,   vol:0.012, crop:'Tea' },
  { id:'coconutoil',  emoji:'🥥', name:'Coconut Oil',   unit:'₹/kg',       mandi:'Kozhikode',       base:196,  vol:0.009, crop:'Coconut' },
  { id:'ginger',      emoji:'🫚', name:'Ginger',        unit:'₹/kg',       mandi:'Ernakulam',       base:38,   vol:0.020, crop:'Ginger' },
  { id:'turmeric',    emoji:'🟡', name:'Turmeric',      unit:'₹/kg',       mandi:'Ernakulam',       base:148,  vol:0.018, crop:'Turmeric' },
  { id:'banana',      emoji:'🍌', name:'Banana',        unit:'₹/kg',       mandi:'Thrissur',        base:32,   vol:0.008, crop:'Banana' },
  { id:'tapioca',     emoji:'🍠', name:'Tapioca',       unit:'₹/kg',       mandi:'Alappuzha',       base:24,   vol:0.007, crop:'Tapioca' },
  { id:'cashew',      emoji:'🥜', name:'Cashew',        unit:'₹/kg',       mandi:'Kollam',          base:760,  vol:0.010, crop:'Cashew' },
];

// Generate 30-day history with realistic walk for each commodity
function generateHistory(base, vol, days=30){
  const arr=[]; let p=base*(0.92+Math.random()*0.08);
  for(let i=0;i<days;i++){
    const chg=(Math.random()-0.49)*vol; // slight upward bias
    p=Math.max(base*0.7, p*(1+chg));
    arr.push(parseFloat(p.toFixed(2)));
  }
  return arr;
}

// Init price state
/**
 * Initializes the market price engine with historical data.
 */
let priceState = {};

function initializePriceState(){
  if (Object.keys(priceState).length) return priceState;
  COMMODITIES.forEach(c=>{
    const history = generateHistory(c.base, c.vol, 30);
    const price = history[history.length - 1];
    const prevPrice = history[history.length - 2] ?? price;
    priceState[c.id] = { price, prevPrice, history };
  });
  refreshWindowPrices();
  return priceState;
}

function initPrices(){
  initializePriceState();
  COMMODITIES.forEach(c=>{
    const s = priceState[c.id];
    const chg = (Math.random()-0.48)*c.vol;
    const newPrice = parseFloat(Math.max(c.base*0.6, s.price*(1+chg)).toFixed(2));
    s.prevPrice = s.price;
    s.price = newPrice;
    s.history.push(newPrice);
    if(s.history.length>30) s.history.shift();
  });
  refreshWindowPrices();
  renderPriceTable();
  renderPriceCards();
  updatePriceKPIs();
  if(currentChartType==='prices') buildChart('prices');
}

// Tick — update prices every 5 mins
function tickPrices(){
  COMMODITIES.forEach(c=>{
    const s = priceState[c.id];
    const chg = (Math.random()-0.48)*c.vol;
    const newPrice = parseFloat(Math.max(c.base*0.6, s.price*(1+chg)).toFixed(2));
    s.prevPrice = s.price;
    s.price = newPrice;
    s.history.push(newPrice);
    if(s.history.length>30) s.history.shift();
  });
  refreshWindowPrices();
  renderPriceTable();
  renderPriceCards();
  updatePriceKPIs();
  if(currentChartType==='prices') buildChart('prices');
}

// ── helpers ──
function pricePct(id){
  const s=priceState[id]; if(!s) return 0;
  return ((s.price-s.prevPrice)/s.prevPrice)*100;
}
function price7dHigh(id){ return Math.max(...(priceState[id]?.history.slice(-7)||[0])); }
function price7dLow(id){  return Math.min(...(priceState[id]?.history.slice(-7)||[0])); }
function priceSignal(id){
  const h=(priceState[id]?.history||[]).slice(-7);
  if(h.length<2) return 'hold';
  const trend=(h[h.length-1]-h[0])/h[0]*100;
  if(trend>1.5) return 'buy';
  if(trend<-1.5) return 'sell';
  return 'hold';
}
function fmtPrice(id){
  const price = priceState[id]?.price;
  return price == null ? '--' : '₹' + price.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtPct(id){
  const p=pricePct(id);
  const sign=p>0?'+':''; return sign+p.toFixed(2)+'%';
}

// ── sparkline canvas ──
function drawSparkline(canvas, history, color){
  if(!canvas) return;
  const w=canvas.width=90, h=canvas.height=28;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  const data=history.slice(-7);
  if(data.length<2) return;
  const mn=Math.min(...data), mx=Math.max(...data);
  const rng=mx-mn||1;
  const pts=data.map((v,i)=>({x:(i/(data.length-1))*(w-4)+2, y:h-2-((v-mn)/rng)*(h-4)}));
  // gradient fill
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,color+'55'); grad.addColorStop(1,color+'00');
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x,h); ctx.lineTo(pts[0].x,h); ctx.closePath();
  ctx.fillStyle=grad; ctx.fill();
  // line
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();
  // dot
  const last=pts[pts.length-1];
  ctx.beginPath(); ctx.arc(last.x,last.y,2.5,0,Math.PI*2);
  ctx.fillStyle=color; ctx.fill();
}

// ── render price table (main view) ──
function renderPriceTable(){
  const tbody=document.getElementById('price-tbody'); if(!tbody) return;
  // sort by abs % change descending
  const sorted=[...COMMODITIES].sort((a,b)=>Math.abs(pricePct(b.id))-Math.abs(pricePct(a.id)));
  tbody.innerHTML='';
  sorted.forEach(c=>{
    const pct=pricePct(c.id); const sig=priceSignal(c.id);
    const col=pct>0.1?'var(--color-primary)':pct<-0.1?'var(--color-danger)':'var(--color-text-faint)';
    const chgCls=pct>0.1?'up':pct<-0.1?'down':'flat';
    const arrow=pct>0.1?'↑':pct<-0.1?'↓':'→';
    const high=price7dHigh(c.id).toLocaleString('en-IN',{maximumFractionDigits:0});
    const low=price7dLow(c.id).toLocaleString('en-IN',{maximumFractionDigits:0});
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><div class="pt-name"><span class="pt-emoji">${c.emoji}</span><div><div class="pt-commodity">${c.name}</div><div class="pt-mandi">${c.mandi} · ${c.unit}</div></div></div></td>
      <td class="pt-price" id="ptp-${c.id}" style="color:${col}">${fmtPrice(c.id)}</td>
      <td class="pt-change ${chgCls}">${arrow} ${fmtPct(c.id)}</td>
      <td class="pt-hl">₹${high}</td>
      <td class="pt-hl">₹${low}</td>
      <td style="text-align:right"><span class="pt-signal ${sig}">${sig.toUpperCase()}</span></td>
      <td class="spark-cell"><canvas id="spark-table-${c.id}" width="90" height="28"></canvas></td>`;
    tbody.appendChild(tr);
  });
  // draw sparklines after DOM update
  requestAnimationFrame(()=>{
    sorted.forEach(c=>{
      const pct=pricePct(c.id);
      const col=pct>0.1?'#4ade80':pct<-0.1?'#f87171':'#7a9982';
      drawSparkline(document.getElementById('spark-table-'+c.id), priceState[c.id]?.history||[], col);
    });
  });
}

// ── render right panel price cards ──
function renderPriceCards(){
  const list=document.getElementById('price-cards-list'); if(!list) return;
  const sorted=[...COMMODITIES].sort((a,b)=>Math.abs(pricePct(b.id))-Math.abs(pricePct(a.id)));
  list.innerHTML='';
  sorted.forEach(c=>{
    const pct=pricePct(c.id);
    const col=pct>0.1?'#4ade80':pct<-0.1?'#f87171':'#7a9982';
    const arrow=pct>0.1?'↑':pct<-0.1?'↓':'→';
    const div=document.createElement('div'); div.className='price-card';
    div.innerHTML=`
      <div class="pc-row1">
        <span style="font-size:15px">${c.emoji}</span>
        <span class="pc-name">${c.name}</span>
        <span class="pc-price" id="pcp-${c.id}" style="color:${col}">${fmtPrice(c.id)}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:1px;">
        <span style="font-size:9px;color:var(--color-text-faint)">${c.mandi} · ${c.unit}</span>
        <span class="pc-change" style="color:${col}">${arrow} ${fmtPct(c.id)}</span>
      </div>
      <div class="pc-spark"><canvas id="spark-card-${c.id}" width="272" height="22"></canvas></div>`;
    list.appendChild(div);
  });
  requestAnimationFrame(()=>{
    sorted.forEach(c=>{
      const pct=pricePct(c.id);
      const col=pct>0.1?'#4ade80':pct<-0.1?'#f87171':'#7a9982';
      drawSparkline(document.getElementById('spark-card-'+c.id), priceState[c.id]?.history||[], col);
    });
  });
}

// ── KPI update for markets ──
function updatePriceKPIs(){
  const sorted=[...COMMODITIES].sort((a,b)=>pricePct(b.id)-pricePct(a.id));
  const top=sorted[0]; const bot=sorted[sorted.length-1];
  document.getElementById('kpi-top-gainer').textContent=top.emoji+' '+top.name;
  document.getElementById('kpi-top-gainer-val').textContent='+'+pricePct(top.id).toFixed(2)+'%';
  document.getElementById('kpi-top-loser').textContent=bot.emoji+' '+bot.name;
  document.getElementById('kpi-top-loser-val').textContent=pricePct(bot.id).toFixed(2)+'%';
}

// ── Markets view toggle ──
function showMarketsView(on){
  const _fv=document.getElementById('flood-view'); if(_fv&&on) _fv.classList.remove('active');
  const mv=document.getElementById('markets-view');
  const mc=document.getElementById('map-container');
  const cp=document.getElementById('chart-panel');
  const kg=document.getElementById('kpi-gainer-bar');
  if(on){
    mv.classList.add('active');
    mc.classList.add('hidden');
    if(kg) kg.style.display='flex';
    renderPriceTable();
    renderPriceCards();
    updatePriceKPIs();
    // switch chart to prices
    const priceTab=document.querySelector('.chart-tab:last-child');
    if(priceTab){ document.querySelectorAll('.chart-tab').forEach(t=>t.classList.remove('active')); priceTab.classList.add('active'); }
    buildChart('prices');
  } else {
    mv.classList.remove('active');
    mc.classList.remove('hidden');
    if(kg) kg.style.display='none';
    // revert chart
    const firstTab=document.querySelector('.chart-tab');
    if(firstTab){ document.querySelectorAll('.chart-tab').forEach(t=>t.classList.remove('active')); firstTab.classList.add('active'); }
    buildChart('rainfall');
  }
}
// Expose price data globally for ai-advisory and news-hub
function refreshWindowPrices(){
  window._prices = COMMODITIES.map(c => {
    const s = priceState[c.id];
    const price = s?.price ?? c.base;
    const prevPrice = s?.prevPrice ?? price;
    const change = parseFloat((price - prevPrice).toFixed(2));
    return {
      name: c.name,
      price,
      change,
      high: s ? price7dHigh(c.id) : price,
      low: s ? price7dLow(c.id) : price,
     unit: c.unit,
   };
  });
}
initializePriceState();

function startMarketEngine(){
  initPrices();
  renderPriceCards();
  updatePriceKPIs();
  setInterval(tickPrices, 5 * 60 * 1000);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', startMarketEngine, { once: true });
} else {
  startMarketEngine();
}