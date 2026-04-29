// ─────────────────────────────────────────────────────
// js/geo.js — Geolocation & Map (Leaflet)
// Depends on: config.js, weather.js (fetchAccuWeatherByCoords)
// ─────────────────────────────────────────────────────

let map; // Leaflet map instance — private to this module

/** Inject minimal Leaflet popup styles once */
function _injectLeafletStyle() {
    if (document.getElementById('leaflet-simple-style')) return;
    const s = document.createElement('style');
    s.id = 'leaflet-simple-style';
    s.innerHTML = `.simple-popup .leaflet-popup-content-wrapper{border-radius:0;border:1px solid #ccc;
        box-shadow:0 2px 5px rgba(0,0,0,.2)}.leaflet-container{font-family:Arial,sans-serif!important}`;
    document.head.appendChild(s);
}

/** Auto-detect location: GPS → IP fallback → hardcoded default */
function initGeolocation() {
    _injectLeafletStyle();
    initMap(window.farmLat, window.farmLng, false); // Render default map immediately
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

/** Triggered by the "Use GPS" button in the UI */
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
        () => {
            alert('GPS denied. Trying IP location...');
            fetchWeatherByIp();
            if (btn) btn.disabled = false;
        },
        { timeout: 8000 }
    );
}

/** Triggered by the manual city-search form */
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

/** Initialize or pan the Leaflet satellite map */
function initMap(lat, lng, isLive = false) {
    const zoom = isLive ? 16 : 12;
    if (!map) {
        map = L.map('farm-map', { zoomControl: false }).setView([lat, lng], zoom);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { attribution: '&copy; Esri', maxZoom: 18 }
        ).addTo(map);
    } else {
        map.flyTo([lat, lng], zoom, { animate: true, duration: 2.5 });
    }

    if (window.currentFarmMarker) map.removeLayer(window.currentFarmMarker);

    const color = isLive ? '#1565c0' : '#0d47a1';
    const icon  = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="width:22px;height:22px;background:${color};border:4px solid white;
                border-radius:50%;box-shadow:0 0 15px rgba(21,101,192,0.6);animation:pulseMarker 2s infinite;"></div>
               <style>@keyframes pulseMarker{0%{box-shadow:0 0 0 0 rgba(21,101,192,0.4);}
               70%{box-shadow:0 0 0 12px rgba(21,101,192,0);}100%{box-shadow:0 0 0 0 rgba(21,101,192,0);}}</style>`,
        iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -15]
    });
    window.currentFarmMarker = L.marker([lat, lng], { icon }).addTo(map);

    const locName = window.detectedLocation || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
    window.currentFarmMarker.bindPopup(
        `<div style="text-align:center;padding:4px;">
            <strong style="color:#1565c0;font-size:1.1em;display:block;margin-bottom:4px;">
                ${isLive ? 'आप यहाँ हैं (You are here)' : '◎ डिफ़ॉल्ट स्थान'}
            </strong>
            <div style="color:#333;font-size:0.9em;">${locName}</div>
        </div>`,
        { className: 'simple-popup' }
    ).openPopup();
}
