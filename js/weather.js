const DISTRICTS = [
  { name:'Thiruvananthapuram', lat:8.5241,  lon:76.9366, crops:['Tapioca','Coconut','Vegetables'],    idealTemp:[25,35], idealRain:[3,10],  idealHum:[60,80] },
  { name:'Kollam',             lat:8.8932,  lon:76.6141, crops:['Cashew','Coconut','Rubber'],          idealTemp:[24,32], idealRain:[2,8],   idealHum:[55,75] },
  { name:'Pathanamthitta',     lat:9.2648,  lon:76.7870, crops:['Rubber','Coconut','Spices'],          idealTemp:[25,32], idealRain:[3,10],  idealHum:[70,80] },
  { name:'Alappuzha',          lat:9.4981,  lon:76.3388, crops:['Rice','Coconut','Coir'],              idealTemp:[24,32], idealRain:[5,15],  idealHum:[70,85] },
  { name:'Kottayam',           lat:9.5916,  lon:76.5222, crops:['Rubber','Coconut','Spices'],          idealTemp:[25,32], idealRain:[3,10],  idealHum:[70,80] },
  { name:'Idukki',             lat:9.9189,  lon:77.1025, crops:['Cardamom','Tea','Coffee'],            idealTemp:[18,26], idealRain:[8,20],  idealHum:[75,90] },
  { name:'Ernakulam',          lat:9.9312,  lon:76.2673, crops:['Coconut','Vegetables','Banana'],      idealTemp:[27,33], idealRain:[3,8],   idealHum:[65,78] },
  { name:'Thrissur',           lat:10.5276, lon:76.2144, crops:['Coconut','Banana','Rubber'],          idealTemp:[27,33], idealRain:[3,8],   idealHum:[65,80] },
  { name:'Palakkad',           lat:10.7867, lon:76.6548, crops:['Rice','Sugarcane','Banana'],          idealTemp:[25,32], idealRain:[4,12],  idealHum:[65,80] },
  { name:'Malappuram',         lat:11.0510, lon:76.0711, crops:['Banana','Coconut','Ginger'],          idealTemp:[26,32], idealRain:[4,10],  idealHum:[70,80] },
  { name:'Kozhikode',          lat:11.2588, lon:75.7804, crops:['Ginger','Turmeric','Coconut'],        idealTemp:[25,30], idealRain:[5,15],  idealHum:[75,85] },
  { name:'Wayanad',            lat:11.6854, lon:76.1320, crops:['Coffee','Tea','Pepper','Cardamom'],   idealTemp:[20,28], idealRain:[5,15],  idealHum:[70,85] },
  { name:'Kannur',             lat:11.8745, lon:75.3704, crops:['Arecanut','Coconut','Pepper'],        idealTemp:[25,32], idealRain:[4,12],  idealHum:[70,85] },
  { name:'Kasaragod',          lat:12.4996, lon:74.9869, crops:['Coconut','Cashew','Arecanut'],        idealTemp:[27,33], idealRain:[3,8],   idealHum:[65,78] },
];

function wxInfo(c){
  if(c===0) return{icon:'☀️',label:'Clear'};
  if(c<=2)  return{icon:'⛅',label:'Part Cloudy'};
  if(c===3) return{icon:'☁️',label:'Overcast'};
  if(c<=49) return{icon:'🌫️',label:'Foggy'};
  if(c<=59) return{icon:'🌦️',label:'Drizzle'};
  if(c<=69) return{icon:'🌧️',label:'Rain'};
  if(c<=79) return{icon:'🌨️',label:'Snow'};
  if(c<=84) return{icon:'🌦️',label:'Showers'};
  if(c<=99) return{icon:'⛈️',label:'Thunderstorm'};
  return{icon:'🌤️',label:'Mixed'};
}

let weatherData = {}

async function fetchWeather(){
  document.getElementById('load-step').textContent='Fetching weather data…';
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  // Fetch one district with 8s timeout + retry once on 429
  async function fetchOne(d, retry=0){
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max&hourly=relativehumidity_2m&timezone=Asia%2FKolkata&forecast_days=7`;
    try{
      const ctrl = new AbortController();
      const timer = setTimeout(()=>ctrl.abort(), 8000);
      const res = await fetch(url, {signal: ctrl.signal});
      clearTimeout(timer);
      if(res.status===429 && retry<1){ await sleep(2000); return fetchOne(d, retry+1); }
      if(!res.ok) return {district:d.name, data:null};
      const data = await res.json();
      return {district:d.name, data};
    } catch(e){ return {district:d.name, data:null}; }
  }

  // Batch into groups of 3 with 1.2s gap — avoids 429 rate limit
  const BATCH = 3;
  for(let i=0; i<DISTRICTS.length; i+=BATCH){
    const batch = DISTRICTS.slice(i, i+BATCH);
    const pct = Math.round((i/DISTRICTS.length)*100);
    document.getElementById('load-step').textContent=`Weather ${pct}% (${i+1}–${Math.min(i+BATCH,DISTRICTS.length)} of ${DISTRICTS.length})…`;
    const results = await Promise.all(batch.map(d=>fetchOne(d)));
    results.forEach(r=>{ 
      if(r.data){
      weatherData[r.district]=r.data;
    //persist today's rainfall for API soil saturation memory
    const todayRain = r.data.daily?.precipitation_sum?.[0] ?? 0;
    savePrecipHistory(r.district,todayRain);
    }
     });
    if(i+BATCH < DISTRICTS.length) await sleep(1200);
  }
  document.getElementById('load-step').textContent='Weather loaded ✓';
}