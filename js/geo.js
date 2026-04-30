// ─────────────────────────────────────────────────────
// js/geo.js — Geolocation & Map (Leaflet + Google Satellite tiles)
// Depends on: config.js, weather.js (fetchAccuWeatherByCoords)
// ─────────────────────────────────────────────────────

let map; // Leaflet map instance

// ── Autocomplete state ────────────────────────────────
let _acTimer    = null;   // debounce timer
let _acIndex    = -1;     // keyboard-highlighted suggestion index
let _acResults  = [];     // current suggestion objects

// ── Styles (injected once) ────────────────────────────

function _injectStyles() {
    if (document.getElementById('geo-styles')) return;
    const s = document.createElement('style');
    s.id = 'geo-styles';
    s.innerHTML = `
        /* Leaflet popup */
        .simple-popup .leaflet-popup-content-wrapper {
            border-radius: 4px; border: 1px solid #ccc;
            box-shadow: 0 2px 8px rgba(0,0,0,.2);
        }
        .leaflet-container { font-family: Arial, sans-serif !important; }

        /* Autocomplete dropdown */
        #search-suggestions {
            position: absolute;
            top: calc(100% + 2px);
            left: 0; right: 0;
            background: #fff;
            border: 1px solid #c5d0ea;
            border-radius: 0 0 6px 6px;
            z-index: 9999;
            max-height: 260px;
            overflow-y: auto;
            box-shadow: 0 6px 18px rgba(0,0,0,0.13);
        }
        .ac-item {
            padding: 9px 12px;
            cursor: pointer;
            font-size: 13px;
            border-bottom: 1px solid #f0f4ff;
            display: flex;
            align-items: flex-start;
            gap: 9px;
            transition: background 0.1s;
        }
        .ac-item:last-child { border-bottom: none; }
        .ac-item:hover, .ac-item.ac-active { background: #e8f0fe; }
        .ac-icon { color: #1565c0; margin-top: 1px; flex-shrink: 0; }
        .ac-main { font-weight: 600; color: #1a1a1a; }
        .ac-sub  { font-size: 11px; color: #777; margin-top: 1px; }
        .ac-empty { padding: 12px; text-align: center; color: #888; font-size: 13px; }
    `;
    document.head.appendChild(s);
}

// ── Init ──────────────────────────────────────────────

function initGeolocation() {
    _injectStyles();
    window.manualPin = false;
    initMap(window.farmLat, window.farmLng, false);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!document.getElementById('search-input-wrapper')?.contains(e.target)) {
            _hideDropdown();
        }
    });

    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                window.manualPin = false;
                window.farmLat = pos.coords.latitude;
                window.farmLng = pos.coords.longitude;
                initMap(pos.coords.latitude, pos.coords.longitude, true);
                fetchAccuWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
                // Persist for session + DB sync
                if (typeof persistLocation === 'function') {
                    persistLocation(pos.coords.latitude, pos.coords.longitude, null);
                }
            },
            () => fetchWeatherByIp(),
            { timeout: 8000, maximumAge: 0 }
        );
    } else {
        fetchWeatherByIp();
    }
}

// ── GPS button ────────────────────────────────────────

function detectGpsLocation() {
    if (!('geolocation' in navigator)) return;
    const btn = document.getElementById('manual-location-btn');
    if (btn) btn.disabled = true;
    window.manualPin = false;
    _hideDropdown();
    navigator.geolocation.getCurrentPosition(
        pos => {
            window.farmLat = pos.coords.latitude;
            window.farmLng = pos.coords.longitude;
            initMap(pos.coords.latitude, pos.coords.longitude, true);
            fetchAccuWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
            if (typeof persistLocation === 'function') {
                persistLocation(pos.coords.latitude, pos.coords.longitude, null);
            }
            if (btn) btn.disabled = false;
        },
        () => { fetchWeatherByIp(); if (btn) btn.disabled = false; },
        { timeout: 8000 }
    );
}

// ── Autocomplete input handlers ───────────────────────

/** Called on every keystroke via oninput */
function onSearchInput(value) {
    clearTimeout(_acTimer);
    const q = value.trim();
    if (q.length < 2) { _hideDropdown(); return; }
    // Debounce: wait 280ms after user stops typing
    _acTimer = setTimeout(() => _fetchSuggestions(q), 280);
}

/** Handle keyboard navigation (Arrow keys, Enter, Escape) */
function handleSearchKey(event) {
    const dropdown = document.getElementById('search-suggestions');
    if (!dropdown) {
        if (event.key === 'Enter') searchManualLocation();
        return;
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        _acIndex = Math.min(_acIndex + 1, _acResults.length - 1);
        _highlightItem();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        _acIndex = Math.max(_acIndex - 1, 0);
        _highlightItem();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (_acIndex >= 0 && _acResults[_acIndex]) {
            _selectSuggestion(_acResults[_acIndex]);
        } else {
            searchManualLocation();
        }
    } else if (event.key === 'Escape') {
        _hideDropdown();
    }
}

/** Fetch suggestions from Photon, fall back to Nominatim */
async function _fetchSuggestions(query) {
    try {
        const biasLat = window.farmLat || 20.5;
        const biasLng = window.farmLng || 78.9;
        const res  = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=20&lang=en&lat=${biasLat}&lon=${biasLng}`
        );
        const data = await res.json();
        const features = (data.features || []);

        // Filter: inside India's bounding box OR country tagged India
        const india = features.filter(f => {
            if (!f.geometry) return false;
            const [lng, lat] = f.geometry.coordinates;
            return _isInIndia(lat, lng)
                || (f.properties && (f.properties.country === 'India' || f.properties.country === 'Bharat'));
        });

        // Map to flat suggestion objects
        _acResults = india.slice(0, 8).map(f => {
            const [lng, lat] = f.geometry.coordinates;
            const p = f.properties;
            const mainParts = [p.name, p.district].filter(Boolean);
            const subParts  = [p.city || p.town || p.village, p.state, 'India'].filter(Boolean);
            return {
                lat, lng,
                main: [...new Set(mainParts)].join(', ') || query,
                sub:  [...new Set(subParts)].slice(0, 2).join(', '),
            };
        });

        if (_acResults.length > 0) {
            _showDropdown(_acResults);
        } else {
            // Show "not found yet" — let user keep typing or press search
            _showEmpty();
        }
    } catch (_) {
        // Silent fail — user can still press the search button
    }
}

function _isInIndia(lat, lng) {
    return lat >= 6.5 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;
}

// ── Dropdown rendering ────────────────────────────────

function _showDropdown(results) {
    _acIndex = -1;
    let dropdown = document.getElementById('search-suggestions');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'search-suggestions';
        document.getElementById('search-input-wrapper')?.appendChild(dropdown);
    }
    dropdown.innerHTML = results.map((r, i) => `
        <div class="ac-item" data-idx="${i}" onmousedown="event.preventDefault()" onclick="_selectSuggestion(_acResults[${i}])">
            <i class="fa-solid fa-location-dot ac-icon"></i>
            <div>
                <div class="ac-main">${_esc(r.main)}</div>
                ${r.sub ? `<div class="ac-sub">${_esc(r.sub)}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function _showEmpty() {
    let dropdown = document.getElementById('search-suggestions');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'search-suggestions';
        document.getElementById('search-input-wrapper')?.appendChild(dropdown);
    }
    dropdown.innerHTML = `<div class="ac-empty"><i class="fa-solid fa-magnifying-glass"></i> Try a different spelling</div>`;
}

function _hideDropdown() {
    const d = document.getElementById('search-suggestions');
    if (d) d.remove();
    _acIndex   = -1;
    _acResults = [];
}

function _highlightItem() {
    document.querySelectorAll('.ac-item').forEach((el, i) => {
        el.classList.toggle('ac-active', i === _acIndex);
    });
}

function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Selection handler ─────────────────────────────────

function _selectSuggestion(result) {
    const input = document.getElementById('manual-location-input');
    if (input) input.value = '';
    _hideDropdown();

    const locationLabel = result.main + (result.sub ? `, ${result.sub}` : '');
    window.detectedLocation = locationLabel;
    window.manualPin = false;
    window.farmLat   = result.lat;
    window.farmLng   = result.lng;

    initMap(result.lat, result.lng, true);
    fetchAccuWeatherByCoords(result.lat, result.lng);

    // Persist for session + DB sync
    if (typeof persistLocation === 'function') {
        persistLocation(result.lat, result.lng, locationLabel);
    }
}

/** Fallback: manual submit via button / Enter without selecting suggestion */
async function searchManualLocation() {
    const input = document.getElementById('manual-location-input');
    const query = input ? input.value.trim() : '';
    _hideDropdown();
    if (!query) return;

    const btn = document.getElementById('manual-location-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    updateLocationBar(`Searching "${query}"...`);

    try {
        // Try Photon first (biased to current location)
        const biasLat = window.farmLat || 20.5;
        const biasLng = window.farmLng || 78.9;
        const res  = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15&lang=en&lat=${biasLat}&lon=${biasLng}`
        );
        const data = await res.json();
        const features = (data.features || []);
        const best = features.find(f => {
            if (!f.geometry) return false;
            const [lng, lat] = f.geometry.coordinates;
            return _isInIndia(lat, lng)
                || (f.properties && (f.properties.country === 'India' || f.properties.country === 'Bharat'));
        });

        if (best) {
            _selectSuggestion({
                lat: best.geometry.coordinates[1],
                lng: best.geometry.coordinates[0],
                main: [best.properties.name, best.properties.district].filter(Boolean).join(', ') || query,
                sub:  [best.properties.city || best.properties.town, best.properties.state].filter(Boolean).join(', ')
            });
        } else {
            // Nominatim fallback
            const nomRes  = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)},India&format=json&limit=1&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const nomData = await nomRes.json();
            if (!nomData || nomData.length === 0) throw new Error(`"${query}" not found.`);
            const place = nomData[0];
            const addr  = place.address || {};
            const name  = addr.neighbourhood || addr.suburb || addr.city_district
                       || addr.city || addr.town || addr.village || query;
            _selectSuggestion({
                lat:  parseFloat(place.lat),
                lng:  parseFloat(place.lon),
                main: name,
                sub:  [addr.city !== name ? addr.city : '', addr.state].filter(Boolean).join(', ')
            });
        }
    } catch (e) {
        const locEl = document.getElementById('accu-location');
        if (locEl) locEl.innerHTML = `<span style="color:#ffcdd2;">⚠ ${e.message}</span>`;
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Search'; }
    if (input) input.value = '';
}

// ── Map init ──────────────────────────────────────────

function initMap(lat, lng, isLive = false) {
    const zoom = isLive ? 16 : 12;
    if (!map) {
        map = L.map('farm-map', { zoomControl: false }).setView([lat, lng], zoom);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        L.tileLayer(
            'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
            { subdomains: ['mt0','mt1','mt2','mt3'], attribution: '&copy; Google Maps', maxZoom: 20 }
        ).addTo(map);

        map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            window.farmLat   = lat;
            window.farmLng   = lng;
            window.manualPin = true;
            const mapEl = document.getElementById('farm-map');
            if (mapEl) { mapEl.style.outline = '3px solid #4CAF50'; setTimeout(() => mapEl.style.outline = 'none', 500); }
            initMap(lat, lng, true);
            fetchAccuWeatherByCoords(lat, lng);
            // Persist map-click location
            if (typeof persistLocation === 'function') {
                persistLocation(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        });
    } else {
        map.flyTo([lat, lng], zoom, { animate: true, duration: 1.8 });
    }

    if (window.currentFarmMarker) map.removeLayer(window.currentFarmMarker);

    const color = isLive ? '#4CAF50' : '#0d47a1';
    const icon  = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;background:${color};border:3px solid white;
               border-radius:50%;box-shadow:0 0 0 0 ${color};
               animation:mapPulse 2s infinite;"></div>
               <style>@keyframes mapPulse{0%{box-shadow:0 0 0 0 rgba(76,175,80,.5);}
               70%{box-shadow:0 0 0 12px rgba(76,175,80,0);}100%{box-shadow:0 0 0 0 rgba(76,175,80,0);}}</style>`,
        iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -14]
    });
    window.currentFarmMarker = L.marker([lat, lng], { icon }).addTo(map);

    const locName = window.detectedLocation || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    window.currentFarmMarker.bindPopup(
        `<div style="text-align:center;min-width:140px;padding:4px;">
            <strong style="color:${color};font-size:13px;display:block;">${isLive ? locName : 'Default Location'}</strong>
            <div style="color:#888;font-size:11px;margin-top:2px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        </div>`,
        { className: 'simple-popup' }
    ).openPopup();
}
