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

  if(rain >= EXTREME_RAIN_THRESHOLD) return 100;
  //api weighted composite formula
  // weight alloc, 40% soil saturation(API),30% IMD alert tier, 20% KSDMA baseline vuln, 10% 3day forecast
  const {apiScore} = computeAPIndex(name,wd.daily.precipitation_sum);
  const imdScore = imdAlert(rain).score ;
  const ksdmascore = Math.max(v.flood,v.landslide,v.wind);
  
  const fc=getFc3d(name);
  const fcScore = fc > 150 ? 80: fc > 80? 50: fc > 40 ? 30: 10;

  return Math.max(0,Math.min(100,Math.round(
    (apiScore*0.40) + (imdScore * 0.30) + (ksdmascore*0.20) + (fcScore * 0.10)
  )));
}
function floodColor(s){ return s>=80?'#f87171':s>=55?'#fb923c':s>=35?'#facc15':'#1a2f22'; }
function riskTypeLabel(name){
  const v=FLOOD_VULN[name]; if(!v) return '🌊 Flood';
  return v.primary==='landslide'?'🏔️ Landslide':v.primary==='wind'?'💨 Wind':'🌊 Flood';
}