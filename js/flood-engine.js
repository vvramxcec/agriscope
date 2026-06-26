//  FLOOD & DISASTER RISK ENGINE (KSDMA + IMD)
// ═══════════════════════════════════════════════════════



// soi saturation engine - Antecedent Precipitation Index (API)
// Formula (IMD/KSDMA hydrological practice):
// API = P_t + 0.7 * P_(t-1) + 0.4 * P_(t-2)

const EXTREME_RAIN_THRESHOLD = 150; // IMD extreme heavyrainfall in active monsoon zones

const API_NORMALISE_MAX = 345 ; // worst case kerala monsoon( 200m(today)+ 0.7 * 150 + 0.4 * 100) = 345mm ), 

function savePrecipHistory(districtName, mmToday){
  try{
    const today = new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
    const key = 'agroscope_precip'+ districtName;
    let hist = JSON.parse(localStorage.getItem(key) || '[]');
    if(hist.length && hist[hist.length-1].date === today){
      hist[hist.length - 1].mm = mmToday; //update same day entry
      } else{
         if (hist.length > 0) {
    const lastDate = new Date(hist[hist.length-1].date + 'T00:00:00');
    const currentDate = new Date(today + 'T00:00:00');
    const diffDays = Math.round((currentDate - lastDate) / (1000 * 60 * 60 * 24));
    for (let i = 1; i < diffDays; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i);
      hist.push({ date: d.toISOString().slice(0, 10), mm: 0 });
    }
  }
  hist.push({date:today, mm:mmToday});
      }
      if(hist.length > 7) hist = hist.slice(-7); // keep last 7 days max
      localStorage.setItem(key,JSON.stringify(hist));
  } catch(e) {
  console.warn("localStorage is unavailable or full. History won't be saved across sessions:", e.message);
}

}

function loadPrecipHistory(districtName){
  try{
    return JSON.parse(localStorage.getItem('agroscope_precip'+districtName) || '[]');
  }
  catch(e){
    return [];
  }
}

// compute the Antecedent Precipitation Index for a distric
// uses live Open-Meteo data for today (P_t = precipitation_sum[0] and localstorage for P_(t-1) and P_(t-2)
// on first load there will be no history, so the formula degrades to  just today's rain, After 3d, it reaches the 3 day memory
// @param {string}   districtName @param {number[]} precipSum   - daily.precipitation_sum from Open-Meteo, @returns {{ api: number, pt: number, pt1: number, pt2: number, apiScore: number }}

function  computeAPIndex(districtName,precipSum){
  const pt = precipSum?.[0] ?? 0; //today's
  const hist = loadPrecipHistory(districtName) //sorted old->new
  const pt1 = hist.length >= 2 ? (hist[hist.length -2 ].mm ?? 0) : 0;
  const pt2 = hist.length >= 3 ? (hist[hist.length - 3].mm??0):0;
  const api = pt + (0.7 * pt1) + (0.4*pt2);
  const apiScore = Math.max(0,Math.min(100,Math.round((api/API_NORMALISE_MAX)*100)));
  return {api,pt,pt1,pt2,apiScore};

}


let FLOOD_VULN = {}

// Change your numbers to these:
function imdAlert(r){
  if(r>115.6) return {level:'red',   label:'🔴 RED',   cls:'imd-red',   score:100};
  if(r>64.5)  return {level:'orange',label:'🟠 ORANGE',cls:'imd-orange',score:70};
  if(r>15.0)  return {level:'yellow',label:'🟡 YELLOW',cls:'imd-yellow',score:40};
  return             {level:'green', label:'🟢 GREEN', cls:'imd-green', score:10};
}
function getFc3d(name){
  const wd=weatherData[name]; if(!wd||!wd.daily) return 0;
  const p=wd.daily.precipitation_sum||[]; return (p[1]||0)+(p[2]||0)+(p[3]||0);
}
function floodComposite(name){
  const wd=weatherData[name]; if(!wd||!wd.daily) return 0;
  const rain=wd.daily.precipitation_sum?.[0]||0;
  const v=FLOOD_VULN[name]||{flood:40,landslide:30,wind:30};

  if(rain >= EXTREME_RAIN_THRESHOLD) return 100;
  //api weighted composite formula
  // weight alloc, 40% soil saturation(API),30% IMD alert tier, 20% KSDMA baseline vuln, 10% 3day forecast
  const {apiScore} = computeAPIndex(name,wd.daily.precipitation_sum);
  const imdScore = imdAlert(rain).score ;
  const ksdmascore = Math.max(v.flood,v.landslide,v.wind);
  
  const fc=getFc3d(name);
  const fcScore = fc > 150 ? 80: fc > 80? 50: fc > 40 ? 30: 10;

  return Math.max(0,Math.min(100,Math.round(
  (apiScore * 0.50) + (imdScore * 0.30) + (ksdmascore * 0.20)
)));
}
function floodColor(s){ return s>=80?'#f87171':s>=55?'#fb923c':s>=35?'#facc15':'#1a2f22'; }
function riskTypeLabel(name){
  const v=FLOOD_VULN[name]; if(!v) return '🌊 Flood';
  return v.primary==='landslide'?'🏔️ Landslide':v.primary==='wind'?'💨 Wind':'🌊 Flood';
}

function buildFloodRows(){
  return DISTRICTS.map(d=>{
    const wd=weatherData[d.name];
    const rain=wd?.daily?.precipitation_sum?.[0]||0;
    const imd=imdAlert(rain); const fc=getFc3d(d.name);
    const v=FLOOD_VULN[d.name]||{flood:40,landslide:30,wind:30};
    const vm=Math.max(v.flood,v.landslide,v.wind);
    const score=floodComposite(d.name);
    const {apiScore} = computeAPIndex(d.name,wd?.daily?.precipitation_sum || [])
    return {name:d.name,rain,imd,fc,vm,score,apiScore};
  }).sort((a,b)=>b.score-a.score);
}
function renderFloodTable(){
  const tb=document.getElementById('flood-tbody'); if(!tb) return;
  if(!weatherData||Object.keys(weatherData).length===0){
    tb.innerHTML='<tr><td colspan="8" style="padding:14px;text-align:center;color:var(--color-text-faint)">⏳ Loading weather data…</td></tr>';
    return;
  }
  const rows=buildFloodRows();
  const cnt={red:0,orange:0,yellow:0,green:0};
  rows.forEach(r=>cnt[r.imd.level]++);
  ['red','orange','yellow','green'].forEach(l=>{
    const el=document.getElementById('fs-'+l); if(el) el.textContent={red:'🔴',orange:'🟠',yellow:'🟡',green:'🟢'}[l]+' '+cnt[l]+' '+l.charAt(0).toUpperCase()+l.slice(1);
  });
   tb.innerHTML=rows.map(r=>`<tr onclick="showDistrictDetail('${r.name.replace(/'/g, "&apos;")}','flood')">
    <td><strong>${r.name}</strong><div style="font-size:10px;color:var(--color-text-faint)">${riskTypeLabel(r.name)}</div></td>
    <td><span class="imd-badge ${r.imd.cls}">${r.imd.label}</span></td>
    <td style="font-weight:600">${r.rain.toFixed(1)} mm</td>
    <td><span style="font-size:11px;font-weight:700;color:${r.apiScore>=70?'#f87171':r.apiScore>=40?'#fb923c':'#7a9982'}">${r.apiScore}</span><span style="font-size:9px;color:var(--color-text-faint)">/100</span></td>
    <td>${r.fc.toFixed(0)} mm</td>
    <td><div style="display:flex;align-items:center;gap:5px"><div style="width:44px;height:4px;background:var(--color-surface-3);border-radius:99px;overflow:hidden"><div style="width:${r.vm}%;height:100%;background:#fb923c;border-radius:99px"></div></div><span style="font-size:10px;color:var(--color-text-faint)">${r.vm}</span></div></td>
    <td><span class="risk-type-pill">${riskTypeLabel(r.name)}</span></td>
    <td><div style="display:flex;align-items:center;gap:5px"><div style="width:44px;height:4px;background:var(--color-surface-3);border-radius:99px;overflow:hidden"><div style="width:${r.score}%;height:100%;background:${floodColor(r.score)};border-radius:99px"></div></div><span style="font-size:11px;font-weight:700;color:${floodColor(r.score)}">${r.score}</span></div></td>
  </tr>`).join('');

}
function renderFloodCards(){
  const list = document.getElementById('flood-cards-list');
  if(!list) return;

  // Guard: no weather data yet
  const distNames = Object.keys(weatherData||{});
  if(distNames.length === 0){
    list.innerHTML = '<div style="padding:14px;font-size:11px;color:var(--color-text-faint)">⏳ Weather data loading…</div>';
    return;
  }

  const rows = DISTRICTS.map(d => {
    const wd  = weatherData[d.name] || {};
    const rain = (wd.daily && wd.daily.precipitation_sum) ? (wd.daily.precipitation_sum[0]||0) : 0;
    const imd  = imdAlert(rain);
    const score = floodComposite(d.name);
    const {apiScore} = computeAPIndex(d.name,wd?.daily?.precipitation_sum || [])
    return {name:d.name, rain, imd, score,apiScore};
  }).sort((a,b) => b.score - a.score);

  list.innerHTML = rows.map(r => {
    const col = floodColor(r.score);
    const apiCol = r.apiScore>=70?'#f87171':r.apiScore>=40?'#fb923c':'#4ade80';
    const rtl = riskTypeLabel(r.name);
    const nm  = r.name.replace(/'/g,"&apos;");
    return '<div class="flood-card" onclick="showDistrictDetail(\'' + nm + '\',\'flood\')">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
      + '<span style="font-size:11px;font-weight:600;flex:1;">' + r.name + '</span>'
      + '<span class="imd-badge ' + r.imd.cls + '" style="font-size:9px;padding:1px 6px;">' + r.imd.label + '</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;">'
      + '<span style="font-size:10px;color:var(--color-text-faint);">' + rtl + ' · ' + r.rain.toFixed(1) + 'mm</span>'
      + '<div style="display:flex;align-items:center;gap:6px;">'
      + '<span style="font-size:9px;color:' + apiCol + '" title="Soil saturation (API)">💧' + r.apiScore + '</span>'
      + '<span style="font-size:10px;font-weight:700;color:' + col + ';">' + r.score + '</span>'
      + '</div></div></div>';
  }).join('');

}
function populateDDFlood(name){
  const body=document.getElementById('dd-flood-body'); if(!body) return;
  const wd=weatherData[name];
  if(!wd||!wd.daily){body.innerHTML='<div style="font-size:11px;color:var(--color-text-faint);padding:8px 0">No weather data available</div>';return;}
  const rain=wd.daily.precipitation_sum?.[0]||0;
  const imd=imdAlert(rain);
  const v=FLOOD_VULN[name]||{flood:40,landslide:30,wind:30};
  const score=floodComposite(name);
  const {api,pt,pt1,pt2,apiScore} = computeAPIndex(name,wd.daily.precipitation_sum|| []);
  const days=wd.daily.precipitation_sum||[];
  const maxR=Math.max(...days.slice(0,7),1);
  const dayL=['Today','D+1','D+2','D+3','D+4','D+5','D+6'];
    const adv=score>=80?'🔴 HIGH — Evacuate low-lying areas. Avoid river crossings. Follow KSDMA advisories.'
    :score>=55?'🟠 ELEVATED — Stay alert. Avoid waterlogged roads. Monitor dam levels.'
    :score>=35?'🟡 WATCH — Be prepared. Check IMD updates. Avoid flood-prone zones.'
    :'🟢 NORMAL — Conditions within safe thresholds.';
  const apiCol = apiScore>=70?'#f87171':apiScore>=40?'#fb923c':'#4ade80';
  body.innerHTML=`<div style="margin-bottom:10px">
    <span class="imd-badge ${imd.cls}" style="font-size:12px;padding:4px 12px">${imd.label} ALERT</span>
    <span style="font-size:11px;color:var(--color-text-faint);margin-left:8px">${rain.toFixed(1)} mm/24h</span>
  </div>
  <div style="font-size:9px;color:var(--color-text-faint);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">7-Day Rainfall Forecast</div>
  <div class="ff-bars">${days.slice(0,7).map((v2,i)=>{
    const h=Math.max(2,Math.round((v2/maxR)*48));
    const col=imdAlert(v2).level==='red'?'#f87171':imdAlert(v2).level==='orange'?'#fb923c':imdAlert(v2).level==='yellow'?'#facc15':'#4ade80';
    return `<div class="ff-col"><div class="ff-val">${v2.toFixed(0)}</div><div class="ff-bar" style="height:${h}px;background:${col}"></div><div class="ff-lbl">${dayL[i]}</div></div>`;
  }).join('')}</div>
  <div style="font-size:9px;color:var(--color-text-faint);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">KSDMA Vulnerability</div>
  ${[['🌊 Flood',v.flood,'#38bdf8'],['🏔️ Landslide',v.landslide,'#fb923c'],['💨 Wind',v.wind,'#a78bfa']].map(([lbl,vl,col])=>`<div class="vuln-row"><span class="vuln-name">${lbl}</span><div class="vuln-bg"><div class="vuln-fill" style="width:${vl}%;background:${col}"></div></div><span class="vuln-val" style="color:${col}">${vl}</span></div>`).join('')}
  <div style="margin-top:8px;padding:8px 10px;border-radius:6px;background:var(--color-surface);border-left:3px solid ${apiCol}">
    <div style="font-size:9px;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">🌱 Soil Saturation (API)</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div style="flex:1;height:5px;background:var(--color-surface-3);border-radius:99px;overflow:hidden"><div style="width:${apiScore}%;height:100%;background:${apiCol};border-radius:99px"></div></div>
      <span style="font-size:12px;font-weight:700;color:${apiCol}">${apiScore}/100</span>
    </div>
    <div style="font-size:10px;color:var(--color-text-muted)">API = ${api.toFixed(1)}mm &nbsp;·&nbsp; T=${pt.toFixed(0)} T-1=${pt1.toFixed(0)} T-2=${pt2.toFixed(0)}</div>
    ${rain>=EXTREME_RAIN_THRESHOLD?'<div style="font-size:10px;color:#f87171;margin-top:3px;font-weight:600">⚠️ Extreme override — >'+EXTREME_RAIN_THRESHOLD+'mm threshold triggered</div>':''}
  </div>
  <div style="margin-top:10px;padding:8px 10px;border-radius:6px;background:var(--color-surface);font-size:11px;line-height:1.5;border-left:3px solid ${floodColor(score)}">${adv}</div>
  <div style="margin-top:5px;font-size:9px;color:var(--color-text-faint)">Score:${score}/100 · 50% API + 30% IMD + 20% KSDMA · Open-Meteo</div>`;

}
