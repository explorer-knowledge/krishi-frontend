// ── Config & Global State ────────────────────────
const API_BASE = 'https://krishi-backend-plfv.onrender.com/api';
let map;
window.weatherContext  = null; // { weather, forecast, agri, location }
window.newsContext     = null; // array of { title, link }
window.farmLat = 23.2599;
window.farmLng = 77.4126;

document.addEventListener('DOMContentLoaded', () => {
    initGeolocation();
    initYieldChart();
    fetchLiveSchemes();
    initChatbotGreeting();
    if (!document.getElementById('leaflet-simple-style')) {
        const s = document.createElement('style');
        s.id = 'leaflet-simple-style';
        s.innerHTML = `.simple-popup .leaflet-popup-content-wrapper{border-radius:0;border:1px solid #ccc;box-shadow:0 2px 5px rgba(0,0,0,.2)}.leaflet-container{font-family:Arial,sans-serif!important}`;
        document.head.appendChild(s);
    }
});

// ── Geolocation: GPS → IP → Default ─────────────
function initGeolocation() {
    initMap(window.farmLat, window.farmLng, false);
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                window.farmLat = pos.coords.latitude;
                window.farmLng = pos.coords.longitude;
                initMap(pos.coords.latitude, pos.coords.longitude, true);
                fetchAccuWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
            },
            () => fetchWeatherByIp(),
            { timeout: 8000, maximumAge: 0 }
        );
    } else {
        fetchWeatherByIp();
    }
}

function detectGpsLocation() {
    if (!('geolocation' in navigator)) return alert('GPS not supported on this device.');
    const btn = document.getElementById('manual-location-btn');
    if (btn) btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
        pos => {
            window.farmLat = pos.coords.latitude;
            window.farmLng = pos.coords.longitude;
            initMap(pos.coords.latitude, pos.coords.longitude, true);
            fetchAccuWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
            if (btn) btn.disabled = false;
        },
        () => { alert('GPS denied. Trying IP location...'); fetchWeatherByIp(); if (btn) btn.disabled = false; },
        { timeout: 8000 }
    );
}

async function fetchWeatherByIp() {
    updateLocationBar('IP से स्थान खोजा जा रहा है... (Detecting via IP...)');
    try {
        const res  = await fetch(`${API_BASE}/weather/by-ip`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        processWeatherResponse(json.data);
    } catch (e) {
        console.error('IP geolocation failed:', e);
        fetchAccuWeatherByCoords(23.2599, 77.4126);
    }
}

async function searchManualLocation() {
    const input = document.getElementById('manual-location-input');
    const city  = input ? input.value.trim() : '';
    if (!city) return;
    const btn = document.getElementById('manual-location-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    updateLocationBar(`"${city}" खोजा जा रहा है...`);
    try {
        const res  = await fetch(`${API_BASE}/weather/by-city?city=${encodeURIComponent(city)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'City not found');
        processWeatherResponse(json.data);
        if (input) input.value = '';
    } catch (e) {
        console.error('City search failed:', e);
        const locEl = document.getElementById('accu-location');
        if (locEl) locEl.innerHTML = `<span style="color:#ffcdd2;">⚠ ${e.message}</span>`;
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> खोजें'; }
}

// Shared: fetch weather by lat/lng (GPS path)
async function fetchAccuWeatherByCoords(lat, lng) {
    try {
        const res  = await fetch(`${API_BASE}/weather?lat=${lat}&lng=${lng}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Weather API failed');
        processWeatherResponse(json.data);
    } catch (e) {
        console.error('Weather error:', e);
        const el = document.getElementById('accu-location');
        if (el) el.innerHTML = '<span style="color:#ffcdd2;">⚠ API Error</span>';
    }
}

// Backward-compat alias used in old inline calls
function fetchAccuWeather(lat, lng) { fetchAccuWeatherByCoords(lat, lng); }

/** Central handler: process any weather API response */
function processWeatherResponse(data) {
    const city  = data.location.city;
    const state = data.location.state;
    const lat   = data.location.lat;
    const lng   = data.location.lng;

    // Update globals
    if (lat != null) { window.farmLat = lat; window.farmLng = lng; }
    window.detectedLocation = `${city}, ${state}`;
    window.detectedState    = state;

    // Store full context for AI
    window.weatherContext = {
        weather:  data.current,
        forecast: data.forecast,
        agri:     data.agri,
        location: `${city}, ${state}`
    };

    // Update map
    if (lat != null) initMap(lat, lng, true);

    // Update UI
    updateLocationBar(`${city}, ${state}`);
    renderCurrentConditions(data.current);
    renderForecast(data.forecast, data.agri);
    renderTempChart(data.forecast);
    updateRegionalNews(state);
    generateAiAdvisory();
}

function updateLocationBar(text) {
    const el = document.getElementById('accu-location');
    if (el) el.textContent = text;
}

// ── Weather Helpers ──────────────────────────────
const weatherHindi = {
    'sunny':'धूप','mostly sunny':'अधिकतर धूप','partly sunny':'आंशिक धूप',
    'hazy sunshine':'धुंधली धूप','hazy moonlight':'धुंधली चाँदनी',
    'clear':'साफ़','mostly clear':'अधिकतर साफ़','partly cloudy':'आंशिक बादल',
    'mostly cloudy':'अधिकतर बादल','cloudy':'बादल छाए','overcast':'घने बादल',
    'dreary':'उदास मौसम','fog':'कोहरा','showers':'बौछारें','rain':'बारिश',
    'mostly cloudy w/ showers':'बादल व बौछारें','partly sunny w/ showers':'धूप व बौछारें',
    'thunderstorm':'तूफ़ान','t-storms':'गरज के साथ तूफ़ान',
    'mostly cloudy w/ t-storms':'बादल व तूफ़ान','partly sunny w/ t-storms':'धूप व तूफ़ान',
    'snow':'बर्फ़बारी','mostly cloudy w/ snow':'बादल व बर्फ़',
    'ice':'बर्फ़ीला','sleet':'ओले','freezing rain':'जमाने वाली बारिश',
    'rain and snow':'बारिश व बर्फ़','hot':'गर्म','cold':'ठंडा',
    'windy':'तेज़ हवा','intermittent clouds':'रुक-रुक कर बादल',
};

function translateWeather(t) {
    if (!t) return '';
    const hi = weatherHindi[t.toLowerCase().trim()];
    return hi ? `${hi} (${t})` : t;
}

function getWeatherIcon(t) {
    t = (t || '').toLowerCase();
    if (t.includes('thunder') || t.includes('t-storm')) return '<i class="fa-solid fa-cloud-bolt" style="color:#ff9800;"></i>';
    if (t.includes('rain') || t.includes('shower'))     return '<i class="fa-solid fa-cloud-showers-heavy" style="color:#1976d2;"></i>';
    if (t.includes('snow') || t.includes('ice') || t.includes('sleet')) return '<i class="fa-solid fa-snowflake" style="color:#90caf9;"></i>';
    if (t.includes('fog') || t.includes('haze'))        return '<i class="fa-solid fa-smog" style="color:#9e9e9e;"></i>';
    if (t.includes('cloud') || t.includes('overcast') || t.includes('dreary')) return '<i class="fa-solid fa-cloud" style="color:#78909c;"></i>';
    if (t.includes('partly') || t.includes('intermittent')) return '<i class="fa-solid fa-cloud-sun" style="color:#ffa726;"></i>';
    if (t.includes('sun') || t.includes('clear'))       return '<i class="fa-solid fa-sun" style="color:#fbc02d;"></i>';
    if (t.includes('wind'))  return '<i class="fa-solid fa-wind" style="color:#607d8b;"></i>';
    if (t.includes('hot'))   return '<i class="fa-solid fa-temperature-arrow-up" style="color:#e53935;"></i>';
    return '<i class="fa-solid fa-cloud-sun" style="color:#ffa726;"></i>';
}

function renderCurrentConditions(d) {
    const s  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const si = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML   = v; };
    si('accu-weather-icon', getWeatherIcon(d.weatherText));
    s('accu-temp',         `${Math.round(d.temperature)}°C`);
    s('accu-weather-text', d.weatherTextTranslated || translateWeather(d.weatherText));
    s('accu-realfeel',     `महसूस (Feels Like): ${Math.round(d.feelsLike)}°C`);
    if (d.observedAt) {
        const dt = new Date(d.observedAt);
        s('accu-obs-time', `अपडेट: ${dt.toLocaleTimeString('hi-IN', { hour:'2-digit', minute:'2-digit' })}`);
    }
    s('accu-humidity',  `${d.humidity}%`);
    s('accu-wind',      `${d.windSpeed} km/h ${d.windDirection || ''}`);
    s('accu-visibility',`${d.visibility} km`);
    s('accu-uv',        `${d.uvIndex} (${d.uvIndexText})`);
    s('accu-dewpoint',  `${d.dewPoint}°C`);
    s('accu-pressure',  `${d.pressure} mb`);
    s('accu-cloud',     `${d.cloudCover}%`);
    s('accu-precip',    `${d.precip1hr} mm`);
}

function renderForecast(fc, agri) {
    if (!fc || fc.length === 0) return;
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('accu-evap',     agri?.evapotranspiration != null ? `${agri.evapotranspiration} mm` : 'N/A');
    s('accu-solar',    agri?.solarIrradiance    != null ? `${Math.round(agri.solarIrradiance)} W/m²` : 'N/A');
    s('accu-sunhours', agri?.hoursOfSun         != null ? `${agri.hoursOfSun} hrs` : 'N/A');
    s('accu-rainprob', agri?.rainProbability    != null ? `${agri.rainProbability}%` : 'N/A');

    const dn = ['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'];
    const tbody = document.getElementById('accu-forecast-body');
    if (!tbody) return;
    tbody.innerHTML = fc.map(f => {
        const dt = new Date(f.date), day = dn[dt.getDay()];
        const ds = dt.toLocaleDateString('hi-IN', { day:'numeric', month:'short' });
        const mx = Math.round(f.maxTemp), mn = Math.round(f.minTemp), rp = f.rainProbability ?? 0;
        let adv = '▸ सामान्य', ac = '#1565c0';
        if (mx >= 42) { adv='◈ अत्यधिक गर्मी'; ac='#d32f2f'; }
        else if (mx >= 38) { adv='⬥ तीव्र गर्मी';  ac='#e65100'; }
        else if (rp >= 70) { adv='❖ भारी वर्षा';   ac='#1565c0'; }
        else if (rp >= 40) { adv='◇ हल्की बारिश';  ac='#f9a825'; }
        return `<tr>
            <td><strong>${day}</strong><br><span style="font-size:11px;color:#666;">${ds}</span></td>
            <td>${getWeatherIcon(f.dayPhrase)} ${translateWeather(f.dayPhrase)}<br><span style="font-size:11px;color:#666;">${getWeatherIcon(f.nightPhrase)} ${translateWeather(f.nightPhrase)}</span></td>
            <td><span style="color:#d32f2f;">${mx}°C</span> / <span style="color:#1565c0;">${mn}°C</span></td>
            <td style="text-align:center;">${rp}%</td>
            <td style="color:${ac};font-size:12px;">${adv}</td>
        </tr>`;
    }).join('');
}

function renderTempChart(fc) {
    const ctx = document.getElementById('tempChart');
    if (!ctx) return;
    const dn = ['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'];
    if (window._tempChartInst) { window._tempChartInst.destroy(); }
    window._tempChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fc.map(f => { const d = new Date(f.date); return dn[d.getDay()] + ' ' + d.getDate(); }),
            datasets: [
                { label:'अधिकतम °C', data: fc.map(f => Math.round(f.maxTemp)), backgroundColor:'rgba(211,47,47,0.7)', borderColor:'#d32f2f', borderWidth:1 },
                { label:'न्यूनतम °C', data: fc.map(f => Math.round(f.minTemp)), backgroundColor:'rgba(21,101,192,0.7)', borderColor:'#1565c0', borderWidth:1 }
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false,
            plugins:{ legend:{ display:true, position:'top', labels:{ font:{size:11}, boxWidth:12 } } },
            scales:{ y:{ min:15, max:50, grid:{ color:'#e0e0e0' }, title:{ display:true, text:'°C', font:{size:11} } }, x:{ grid:{ display:false } } }
        }
    });
}

// ── Map ─────────────────────────────────────────
function initMap(farmLat, farmLng, isLive = false) {
    const zoom = isLive ? 16 : 12;
    if (!map) {
        map = L.map('farm-map', { zoomControl:false }).setView([farmLat, farmLng], zoom);
        L.control.zoom({ position:'bottomright' }).addTo(map);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution:'&copy; Esri', maxZoom:18
        }).addTo(map);
    } else {
        map.flyTo([farmLat, farmLng], zoom, { animate:true, duration:2.5 });
    }
    if (window.currentFarmMarker) map.removeLayer(window.currentFarmMarker);
    const color = isLive ? '#1565c0' : '#0d47a1';
    const icon = L.divIcon({
        className:'custom-map-marker',
        html:`<div style="width:22px;height:22px;background:${color};border:4px solid white;border-radius:50%;box-shadow:0 0 15px rgba(21,101,192,0.6);animation:pulseMarker 2s infinite;"></div>
        <style>@keyframes pulseMarker{0%{box-shadow:0 0 0 0 rgba(21,101,192,0.4);}70%{box-shadow:0 0 0 12px rgba(21,101,192,0);}100%{box-shadow:0 0 0 0 rgba(21,101,192,0);}}</style>`,
        iconSize:[22,22], iconAnchor:[11,11], popupAnchor:[0,-15]
    });
    window.currentFarmMarker = L.marker([farmLat, farmLng], { icon }).addTo(map);
    const locName = window.detectedLocation || `${farmLat.toFixed(4)}°N, ${farmLng.toFixed(4)}°E`;
    window.currentFarmMarker.bindPopup(`<div style="text-align:center;padding:4px;">
        <strong style="color:#1565c0;font-size:1.1em;display:block;margin-bottom:4px;">${isLive ? 'आप यहाँ हैं (You are here)' : '◎ डिफ़ॉल्ट स्थान'}</strong>
        <div style="color:#333;font-size:0.9em;">${locName}</div>
    </div>`, { className:'simple-popup' }).openPopup();
}

// ── Yield Chart ─────────────────────────────────
function initYieldChart() {
    const canvas = document.getElementById('yieldChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const wg = ctx.createLinearGradient(0, 0, 0, 250);
    wg.addColorStop(0,'rgba(255,152,0,0.45)'); wg.addColorStop(0.5,'rgba(255,183,77,0.15)'); wg.addColorStop(1,'rgba(255,152,0,0)');
    const sg = ctx.createLinearGradient(0, 0, 0, 250);
    sg.addColorStop(0,'rgba(13,71,161,0.4)'); sg.addColorStop(0.5,'rgba(100,181,246,0.12)'); sg.addColorStop(1,'rgba(13,71,161,0)');
    new Chart(canvas, {
        type:'line',
        data:{
            labels:['2019-20','2020-21','2021-22','2022-23','2023-24'],
            datasets:[
                { label:'गेहूं (Wheat) टन/हे.', data:[3.2,3.4,3.1,3.8,4.1], backgroundColor:wg, borderColor:'#ef6c00', borderWidth:3, tension:0.4, fill:true, pointBackgroundColor:'#fff', pointBorderColor:'#ef6c00', pointBorderWidth:2.5, pointRadius:6, pointHoverRadius:9 },
                { label:'सोयाबीन (Soybean) टन/हे.', data:[1.8,2.0,1.6,2.2,2.5], backgroundColor:sg, borderColor:'#0d47a1', borderWidth:3, tension:0.4, fill:true, pointBackgroundColor:'#fff', pointBorderColor:'#0d47a1', pointBorderWidth:2.5, pointRadius:6, pointHoverRadius:9 }
            ]
        },
        options:{
            responsive:true, maintainAspectRatio:false,
            interaction:{ intersect:false, mode:'index' },
            plugins:{ legend:{ display:true, position:'top', labels:{ font:{size:11}, boxWidth:14, padding:15, usePointStyle:true, pointStyle:'circle' } }, tooltip:{ backgroundColor:'rgba(0,0,0,0.8)', padding:10, cornerRadius:4 } },
            scales:{ y:{ min:0.5, max:5, grid:{ color:'rgba(0,0,0,0.06)' }, title:{ display:true, text:'टन / हेक्टेयर', font:{size:11} }, ticks:{ font:{size:11}, stepSize:0.5 } }, x:{ grid:{ display:false }, ticks:{ font:{size:11} } } }
        }
    });
}

// ── Regional News (stores context for AI) ────────
async function updateRegionalNews(state) {
    const newsHeader = document.getElementById('regional-news-header');
    const newsList   = document.getElementById('regional-news-list');
    if (!newsHeader || !newsList) return;
    newsList.innerHTML = '<li><span class="time"><i class="fa-solid fa-spinner fa-spin"></i> Loading live news...</span></li>';

    const ls = state ? state.toLowerCase() : '';
    if (ls.includes('maharashtra'))  newsHeader.textContent = 'प्रादेशिक बातम्या (महाराष्ट्र)';
    else if (ls.includes('bengal'))  newsHeader.textContent = 'আঞ্চলিক সংবাদ (পশ্চিমবঙ্গ)';
    else if (ls.includes('gujarat')) newsHeader.textContent = 'પ્રાદેશિક સમાચાર (ગુજરાત)';
    else if (ls.includes('karnataka')) newsHeader.textContent = 'ಪ್ರಾದೇಶಿಕ ಸುದ್ದಿ (ಕರ್ನಾಟಕ)';
    else if (ls.includes('tamil'))   newsHeader.textContent = 'பிராந்திய செய்திகள் (தமிழ்நாடு)';
    else if (ls.includes('kerala'))  newsHeader.textContent = 'പ്രാദേശിക വാർത്തകൾ (കേരളം)';
    else if (ls.includes('punjab'))  newsHeader.textContent = 'ਖੇਤਰੀ ਖ਼ਬਰਾਂ (ਪੰਜਾਬ)';
    else if (['madhya pradesh','uttar pradesh','bihar','rajasthan','haryana','chhattisgarh','jharkhand','uttarakhand','himachal'].some(s => ls.includes(s)))
        newsHeader.textContent = `क्षेत्रीय समाचार (${state})`;
    else newsHeader.textContent = `Regional News (${state || 'Your Region'})`;

    try {
        const res  = await fetch(`${API_BASE}/news?state=${encodeURIComponent(state || 'Madhya Pradesh')}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to fetch news');

        const articles = json.data.articles;
        // Store news for AI context
        window.newsContext = articles;

        const html = articles.map(n =>
            `<li class="yojana-item"><span style="color:#666;margin-right:6px;">●</span><a href="${n.link}" target="_blank" style="color:inherit;text-decoration:none;">${n.title}</a></li>`
        ).join('');
        newsList.innerHTML = html + html; // duplicate for smooth infinite scroll
    } catch (e) {
        console.error('News Error:', e);
        newsList.innerHTML = '<li><span class="time" style="color:red;">Failed to load news. Showing cached data.</span></li>';
    }
}

// ── AI Advisory Generator ────────────────────────
async function generateAiAdvisory() {
    const el = document.getElementById('ai-advisory-content');
    if (!el || !window.weatherContext) return;

    el.innerHTML = `<div style="text-align:center;padding:20px 10px;color:#555;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.8rem;color:var(--gov-blue);display:block;margin-bottom:10px;"></i>
        <div style="font-size:13px;">AI सलाह तैयार हो रही है... (Generating advice...)</div>
    </div>`;

    const ctx = window.weatherContext;
    const newsHeadlines = (window.newsContext || []).slice(0, 5).map(n => n.title).join('; ');

    const prompt = `Location: ${ctx.location}.
Current weather: ${ctx.weather.temperature}°C, ${ctx.weather.weatherText}, Humidity ${ctx.weather.humidity}%, Wind ${ctx.weather.windSpeed} km/h.
5-day forecast: ${ctx.forecast.map(f => `${f.date}: Max ${Math.round(f.maxTemp)}°C, Rain ${f.rainProbability}%`).join(' | ')}.
${newsHeadlines ? `Recent agri news: ${newsHeadlines}.` : ''}
Based on this, give 3 specific, numbered farming advisories for today and this week. Be very concise (2-3 lines each). Start in Hindi, add English in brackets. Focus on: irrigation, crop risk, harvesting timing, or pest alerts.`;

    try {
        const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                context: { ...ctx, news: window.newsContext || [] }
            })
        });
        const json = await res.json();
        if (!json.success || !json.data?.reply) throw new Error('No advisory');

        let html = json.data.reply;
        if (typeof marked !== 'undefined') html = marked.parse(html);
        el.innerHTML = `<div style="font-size:12.5px;line-height:1.7;color:#333;padding:4px 0;">${html}</div>`;
    } catch (e) {
        console.error('AI Advisory error:', e);
        el.innerHTML = `<div style="font-size:12px;color:#888;padding:10px 0;">AI सलाह अभी उपलब्ध नहीं है। (Advisory unavailable right now.)</div>`;
    }
}

// ── Chatbot ──────────────────────────────────────
let chatHistory = [];
let ttsEnabled  = false;

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 0.95; utter.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith('hi')) || voices.find(v => v.lang.startsWith('en-IN')) || null;
    if (v) utter.voice = v;
    utter.lang = 'hi-IN';
    window.speechSynthesis.speak(utter);
}

function stopSpeaking() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('tts-toggle');
    if (btn) {
        btn.innerHTML = ttsEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
        btn.title = ttsEnabled ? 'TTS चालू (ON)' : 'TTS बंद (OFF)';
    }
    if (!ttsEnabled) stopSpeaking();
}

function makeBotBubble(html, rawText) {
    const speakerBtn = `<button onclick="speakText(this.parentElement.dataset.raw)" style="background:none;border:none;cursor:pointer;color:#999;font-size:12px;float:right;padding:0 0 0 6px;" title="सुनें"><i class="fa-solid fa-volume-up"></i></button>`;
    return `<div class="chat-bubble bot-bubble" data-raw="${(rawText||'').replace(/"/g,'&quot;')}">${speakerBtn}${html}</div>`;
}

function initChatbotGreeting() {
    const mc = document.getElementById('chatbot-messages');
    if (!mc) return;
    const h = new Date().getHours();
    let g = 'शुभ संध्या (Good evening)!';
    if (h >= 21 || h < 5) g = 'शुभ रात्रि (Good night)!';
    else if (h < 12) g = 'सुप्रभात (Good morning)!';
    else if (h < 17) g = 'शुभ अपराह्न (Good afternoon)!';
    const helpMsg = 'नमस्ते, मैं आपकी कैसे सहायता कर सकता हूँ?\n\nNamaste, how may I help you? Ask me about weather impact on crops, irrigation, pest control, or government schemes!';
    mc.innerHTML = makeBotBubble(g, g) + makeBotBubble(helpMsg.replace('\n\n', '<br><br>'), helpMsg);
    chatHistory.push({ role: 'assistant', content: `${g} ${helpMsg}` });
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
}

function toggleChatbot()  { document.getElementById('chatbot-window').classList.toggle('chatbot-hidden'); }
function handleChatInput(e) { if (e.key === 'Enter') processChatInput(); }
function sendChatMessage(t) { document.getElementById('chatbot-input').value = t; processChatInput(); }

async function processChatInput() {
    const inp = document.getElementById('chatbot-input');
    const mc  = document.getElementById('chatbot-messages');
    const text = inp.value.trim();
    if (!text) return;

    mc.innerHTML += `<div class="chat-bubble user-bubble">${text}</div>`;
    inp.value = '';
    mc.scrollTop = mc.scrollHeight;
    chatHistory.push({ role: 'user', content: text });

    const lid = 'loading-' + Date.now();
    mc.innerHTML += `<div id="${lid}" class="chat-bubble bot-bubble"><i>Typing...</i></div>`;
    mc.scrollTop = mc.scrollHeight;

    // Build context payload from global state
    const context = window.weatherContext ? {
        ...window.weatherContext,
        news: window.newsContext || []
    } : null;

    try {
        const res  = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory.slice(-10), context })
        });
        const json = await res.json();
        const le = document.getElementById(lid); if (le) le.remove();

        if (json.success && json.data?.reply) {
            const rawText = json.data.reply;
            chatHistory.push({ role: 'assistant', content: rawText });
            let bt = rawText;
            if (typeof marked !== 'undefined') bt = marked.parse(bt);
            mc.innerHTML += makeBotBubble(bt, rawText);
            if (ttsEnabled) speakText(rawText);
        } else {
            throw new Error(json.error || 'No response');
        }
    } catch (e) {
        console.error('Chatbot Error:', e);
        const le = document.getElementById(lid); if (le) le.remove();
        mc.innerHTML += makeBotBubble('<span style="color:red;">त्रुटि हुई। (Error, try again.)</span>', 'Error occurred');
    }
    mc.scrollTop = mc.scrollHeight;
}

// ── Schemes ──────────────────────────────────────
async function fetchLiveSchemes() {
    const yl = document.getElementById('yojana-list');
    if (!yl) return;
    try {
        const res  = await fetch(`${API_BASE}/schemes`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed');
        const sd   = json.data.schemes;
        const html = sd.map(s => `<li class="yojana-item"><span style="color:#666;margin-right:6px;">●</span>${s}</li>`).join('');
        yl.innerHTML = html + html;
    } catch (e) {
        console.error('Schemes Error:', e);
        yl.innerHTML = '<li><span class="time" style="color:red;">Failed to load schemes</span></li>';
    }
}

// ── Alert Subscription ───────────────────────────
async function subscribeAlerts(event) {
    event.preventDefault();
    const mobile = document.getElementById('sub-mobile').value.trim();
    const cropsText = document.getElementById('sub-crops').value.trim();
    const size = document.getElementById('sub-size').value;
    const irrigation = document.getElementById('sub-irrigation').value;
    const lang = document.querySelector('input[name="sub-lang"]:checked').value;
    const waOptIn = document.getElementById('sub-wa').checked;
    const submitBtn = document.getElementById('sub-btn');

    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
        alert('कृपया सही 10-अंकीय मोबाइल नंबर दर्ज करें।\nPlease enter a valid 10-digit mobile number.');
        return;
    }

    const cropTypes = cropsText ? cropsText.split(',').map(c => c.trim()).filter(c => c) : [];

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'प्रोसेसिंग...';
        const res  = await fetch(`${API_BASE}/alerts/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile,
                state: window.detectedState || 'Unknown',
                location: { lat: window.farmLat || null, lng: window.farmLng || null },
                whatsappOptIn: waOptIn,
                cropTypes,
                farmSizeAcres: size ? parseFloat(size) : null,
                irrigationType: irrigation,
                preferredLanguage: lang
            })
        });
        const json = await res.json();
        if (json.success) {
            alert(json.data.message);
            document.getElementById('alert-form').reset();
        } else {
            alert('त्रुटि (Error): ' + json.error);
        }
    } catch (e) {
        console.error('Subscription Error:', e);
        alert('नेटवर्क त्रुटि। कृपया बाद में पुनः प्रयास करें।\nNetwork error. Please try again later.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'सब्सक्राइब करें (Subscribe)';
    }
}

// Form listener handled via onsubmit in HTML
