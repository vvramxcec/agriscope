const FLOOD_VULN = {
  'Alappuzha':         {flood:95,landslide:10,wind:70,primary:'flood'},
  'Idukki':            {flood:55,landslide:95,wind:20,primary:'landslide'},
  'Wayanad':           {flood:50,landslide:92,wind:15,primary:'landslide'},
  'Ernakulam':         {flood:78,landslide:35,wind:55,primary:'flood'},
  'Pathanamthitta':    {flood:72,landslide:65,wind:25,primary:'flood'},
  'Kottayam':          {flood:70,landslide:55,wind:30,primary:'flood'},
  'Kozhikode':         {flood:60,landslide:40,wind:70,primary:'wind'},
  'Thrissur':          {flood:65,landslide:30,wind:45,primary:'flood'},
  'Malappuram':        {flood:58,landslide:48,wind:50,primary:'flood'},
  'Palakkad':          {flood:55,landslide:35,wind:40,primary:'flood'},
  'Kollam':            {flood:60,landslide:40,wind:55,primary:'flood'},
  'Kannur':            {flood:50,landslide:45,wind:65,primary:'wind'},
  'Kasaragod':         {flood:45,landslide:35,wind:70,primary:'wind'},
  'Thiruvananthapuram':{flood:48,landslide:40,wind:60,primary:'wind'},
};
function imdAlert(r){
  if(r>204.4) return {level:'red',   label:'🔴 RED',   cls:'imd-red',   score:100};
  if(r>115.6) return {level:'orange',label:'🟠 ORANGE',cls:'imd-orange',score:70};
  if(r>64.5)  return {level:'yellow',label:'🟡 YELLOW',cls:'imd-yellow',score:40};
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
  const fc=getFc3d(name);
  return Math.min(100,Math.round(
    imdAlert(rain).score*0.5 + Math.max(v.flood,v.landslide,v.wind)*0.3 +
    (fc>150?80:fc>80?50:fc>40?30:10)*0.2
  ));
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
    return {name:d.name,rain,imd,fc,vm,score};
  }).sort((a,b)=>b.score-a.score);
}
function renderFloodTable(){
  const tb=document.getElementById('flood-tbody'); if(!tb) return;
  if(!weatherData||Object.keys(weatherData).length===0){
    tb.innerHTML='<tr><td colspan="7" style="padding:14px;text-align:center;color:var(--color-text-faint)">⏳ Loading weather data…</td></tr>';
    return;
  }
  const rows=buildFloodRows();
  const cnt={red:0,orange:0,yellow:0,green:0};
  rows.forEach(r=>cnt[r.imd.level]++);
  ['red','orange','yellow','green'].forEach(l=>{
    const el=document.getElementById('fs-'+l); if(el) el.textContent={red:'🔴',orange:'🟠',yellow:'🟡',green:'🟢'}[l]+' '+cnt[l]+' '+l.charAt(0).toUpperCase()+l.slice(1);
  });
  tb.innerHTML=rows.map(r=>`<tr onclick="showDistrictDetail('${r.name}','flood')">
    <td><strong>${r.name}</strong><div style="font-size:10px;color:var(--color-text-faint)">${riskTypeLabel(r.name)}</div></td>
    <td><span class="imd-badge ${r.imd.cls}">${r.imd.label}</span></td>
    <td style="font-weight:600">${r.rain.toFixed(1)} mm</td>
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
    return {name:d.name, rain, imd, score};
  }).sort((a,b) => b.score - a.score);

  list.innerHTML = rows.map(r => {
    const col = floodColor(r.score);
    const rtl = riskTypeLabel(r.name);
    const nm  = r.name.replace(/'/g,"\'");
    return '<div class="flood-card" onclick="showDistrictDetail(\'' + nm + '\',\'flood\')">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
      + '<span style="font-size:11px;font-weight:600;flex:1;">' + r.name + '</span>'
      + '<span class="imd-badge ' + r.imd.cls + '" style="font-size:9px;padding:1px 6px;">' + r.imd.label + '</span>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;">'
      + '<span style="font-size:10px;color:var(--color-text-faint);">' + rtl + ' · ' + r.rain.toFixed(1) + 'mm</span>'
      + '<span style="font-size:10px;font-weight:700;color:' + col + ';">' + r.score + '</span>'
      + '</div></div>';
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
  const days=wd.daily.precipitation_sum||[];
  const maxR=Math.max(...days.slice(0,7),1);
  const dayL=['Today','D+1','D+2','D+3','D+4','D+5','D+6'];
  const adv=score>=80?'🔴 HIGH — Evacuate low-lying areas. Avoid river crossings. Follow KSDMA advisories.'
    :score>=55?'🟠 ELEVATED — Stay alert. Avoid waterlogged roads. Monitor dam levels.'
    :score>=35?'🟡 WATCH — Be prepared. Check IMD updates. Avoid flood-prone zones.'
    :'🟢 NORMAL — Conditions within safe thresholds.';
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
  <div style="margin-top:10px;padding:8px 10px;border-radius:6px;background:var(--color-surface);font-size:11px;line-height:1.5;border-left:3px solid ${floodColor(score)}">${adv}</div>
  <div style="margin-top:5px;font-size:9px;color:var(--color-text-faint)">Score:${score}/100 · KSDMA · IMD · Open-Meteo</div>`;
}