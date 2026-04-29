// ─────────────────────────────────────────────────────
// js/weather.js — Weather fetching & DOM rendering
// Depends on: config.js, geo.js (initMap), news.js (updateRegionalNews), advisory.js (generateAiAdvisory)
// ─────────────────────────────────────────────────────

/** Hindi translation table for weather conditions */
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

/** Translate English weather text to selected language */
function translateWeather(t) {
    if (!t) return '';
    const hi = weatherHindi[t.toLowerCase().trim()];
    if (window.currentLang === 'hi') return hi || t;
    return t;
}

/** Return a FontAwesome weather icon HTML string for a weather condition */
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

/** Update the location label in the weather panel */
function updateLocationBar(text) {
    const el = document.getElementById('accu-location');
    if (el) el.textContent = text;
}

// ── Fetch Functions ────────────────────────────────

async function fetchWeatherByIp() {
    const cached = sessionStorage.getItem('weatherData_ip');
    if (cached) {
        console.log('Using session cached weather for IP');
        processWeatherResponse(JSON.parse(cached));
        return;
    }
    updateLocationBar(window.currentLang === 'hi' ? 'IP से स्थान खोजा जा रहा है...' : 'Detecting location via IP...');
    try {
        const res  = await fetch(`${API_BASE}/weather/by-ip`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        sessionStorage.setItem('weatherData_ip', JSON.stringify(json.data));
        processWeatherResponse(json.data);
    } catch (e) {
        console.error('IP geolocation failed:', e);
        fetchAccuWeatherByCoords(23.2599, 77.4126); // Default: Bhopal
    }
}

async function fetchAccuWeatherByCoords(lat, lng) {
    const cacheKey = `weatherData_${lat}_${lng}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
        console.log('Using session cached weather for coords');
        processWeatherResponse(JSON.parse(cached));
        return;
    }
    try {
        const res  = await fetch(`${API_BASE}/weather?lat=${lat}&lng=${lng}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Weather API failed');
        sessionStorage.setItem(cacheKey, JSON.stringify(json.data));
        processWeatherResponse(json.data);
    } catch (e) {
        console.error('Weather error:', e);
        const el = document.getElementById('accu-location');
        if (el) el.innerHTML = '<span style="color:#ffcdd2;">⚠ API Error</span>';
    }
}

// Backward-compat alias (used in old inline onclick handlers)
function fetchAccuWeather(lat, lng) { fetchAccuWeatherByCoords(lat, lng); }

// ── Central Response Processor ─────────────────────

/** Handles any weather API response object — updates globals, map, and all UI panels */
function processWeatherResponse(data) {
    const { city, state, lat, lng } = data.location;

    // Update shared globals
    if (lat != null) { window.farmLat = lat; window.farmLng = lng; }
    window.detectedLocation = `${city}, ${state}`;
    window.detectedState    = state;
    window.weatherContext   = {
        weather:  data.current,
        forecast: data.forecast,
        agri:     data.agri,
        location: `${city}, ${state}`
    };

    // Cascade UI updates
    if (lat != null) initMap(lat, lng, true);
    updateLocationBar(`${city}, ${state}`);
    renderCurrentConditions(data.current);
    renderForecast(data.forecast, data.agri);
    renderTempChart(data.forecast);
    updateRegionalNews(state);
    if (typeof window.generateAiAdvisory === 'function') {
        window.generateAiAdvisory();
    }
}

// ── DOM Render Functions ───────────────────────────

function renderCurrentConditions(d) {
    const s  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const si = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML   = v; };
    si('accu-weather-icon', getWeatherIcon(d.weatherText));
    s('accu-temp',          `${Math.round(d.temperature)}°C`);
    s('accu-weather-text',  d.weatherTextTranslated || translateWeather(d.weatherText));
    s('accu-realfeel',      window.currentLang === 'hi' ? `महसूस: ${Math.round(d.feelsLike)}°C` : `Feels Like: ${Math.round(d.feelsLike)}°C`);
    if (d.observedAt) {
        const dt = new Date(d.observedAt);
        const l = window.currentLang === 'hi' ? 'hi-IN' : 'en-IN';
        s('accu-obs-time', `${window.currentLang === 'hi' ? 'अपडेट' : 'Updated'}: ${dt.toLocaleTimeString(l, { hour:'2-digit', minute:'2-digit' })}`);
    }
    s('accu-humidity',   `${d.humidity}%`);
    s('accu-wind',       `${d.windSpeed} km/h ${d.windDirection || ''}`);
    s('accu-visibility', `${d.visibility} km`);
    s('accu-uv',         `${d.uvIndex} (${d.uvIndexText})`);
    s('accu-dewpoint',   `${d.dewPoint}°C`);
    s('accu-pressure',   `${d.pressure} mb`);
    s('accu-cloud',      `${d.cloudCover}%`);
    s('accu-precip',     `${d.precip1hr} mm`);
}

function renderForecast(fc, agri) {
    if (!fc || fc.length === 0) return;
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('accu-evap',     agri?.evapotranspiration != null ? `${agri.evapotranspiration} mm`            : 'N/A');
    s('accu-solar',    agri?.solarIrradiance    != null ? `${Math.round(agri.solarIrradiance)} W/m²` : 'N/A');
    s('accu-sunhours', agri?.hoursOfSun         != null ? `${agri.hoursOfSun} hrs`                   : 'N/A');
    s('accu-rainprob', agri?.rainProbability    != null ? `${agri.rainProbability}%`                 : 'N/A');

    const dnHi = ['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'];
    const dnEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dn = window.currentLang === 'hi' ? dnHi : dnEn;
    const tbody = document.getElementById('accu-forecast-body');
    if (!tbody) return;

    tbody.innerHTML = fc.map(f => {
        const dt  = new Date(f.date);
        const day = dn[dt.getDay()];
        const l = window.currentLang === 'hi' ? 'hi-IN' : 'en-IN';
        const ds  = dt.toLocaleDateString(l, { day: 'numeric', month: 'short' });
        const mx  = Math.round(f.maxTemp), mn = Math.round(f.minTemp), rp = f.rainProbability ?? 0;
        let adv = window.currentLang === 'hi' ? '▸ सामान्य' : '▸ Normal', ac = '#1565c0';
        if      (mx >= 42) { adv = window.currentLang === 'hi' ? '◈ अत्यधिक गर्मी' : '◈ Extreme Heat'; ac = '#d32f2f'; }
        else if (mx >= 38) { adv = window.currentLang === 'hi' ? '⬥ तीव्र गर्मी' : '⬥ High Heat';   ac = '#e65100'; }
        else if (rp >= 70) { adv = window.currentLang === 'hi' ? '❖ भारी वर्षा' : '❖ Heavy Rain';     ac = '#1565c0'; }
        else if (rp >= 40) { adv = window.currentLang === 'hi' ? '◇ हल्की बारिश' : '◇ Light Rain';    ac = '#f9a825'; }
        return `<tr>
            <td><strong>${day}</strong><br><span style="font-size:11px;color:#666;">${ds}</span></td>
            <td>${getWeatherIcon(f.dayPhrase)} ${translateWeather(f.dayPhrase)}<br>
                <span style="font-size:11px;color:#666;">${getWeatherIcon(f.nightPhrase)} ${translateWeather(f.nightPhrase)}</span></td>
            <td><span style="color:#d32f2f;">${mx}°C</span> / <span style="color:#1565c0;">${mn}°C</span></td>
            <td style="text-align:center;">${rp}%</td>
            <td style="color:${ac};font-size:12px;">${adv}</td>
        </tr>`;
    }).join('');
}
