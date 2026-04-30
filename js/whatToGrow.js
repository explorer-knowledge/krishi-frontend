const SEASONS = {
  en: { kharif: 'Kharif (Jun-Oct)', rabi: 'Rabi (Oct-Mar)', zaid: 'Zaid (Mar-Jun)' },
  
};
const SOIL_TYPES = {
  en: ['Black', 'Alluvial', 'Red', 'Sandy', 'Clay'],
  
};

// ── Persist farm profile to localStorage so login can pick it up ──────────
const FARM_PROFILE_KEY = 'krishi_farm_profile';

function saveFarmProfile() {
    const profile = {
        state:        document.getElementById('state-select')?.value      || null,
        district:     document.getElementById('district-input')?.value    || null,
        season:       document.getElementById('season-select')?.value     || null,
        cropTypes:    document.getElementById('crop-type-input')?.value
                        ? [document.getElementById('crop-type-input').value] : [],
        soilType:     document.getElementById('soil-select')?.value       || null,
        farmSizeAcres:parseFloat(document.getElementById('farm-size')?.value) || null,
        hasIrrigation:document.getElementById('irrigation-toggle')?.checked ?? null,
        soilData: {
            nitrogen:   parseFloat(document.getElementById('n-value')?.value)        || null,
            phosphorus: parseFloat(document.getElementById('p-value')?.value)        || null,
            potassium:  parseFloat(document.getElementById('k-value')?.value)        || null,
            ph:         parseFloat(document.getElementById('ph-value')?.value)       || null,
            moisture:   parseFloat(document.getElementById('moisture-value')?.value) || null,
            rainfall:   parseFloat(document.getElementById('rainfall-value')?.value) || null,
            temperature:parseFloat(document.getElementById('temp-value')?.value)     || null,
        }
    };
    try {
        localStorage.setItem(FARM_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) { /* localStorage unavailable */ }
}

function restoreFarmProfile() {
    try {
        const raw = localStorage.getItem(FARM_PROFILE_KEY);
        if (!raw) return;
        const p = JSON.parse(raw);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val != null) el.value = val;
        };
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el && val != null) el.checked = val;
        };

        setVal('state-select',      p.state);
        setVal('district-input',    p.district);
        setVal('season-select',     p.season);
        setVal('crop-type-input',   p.cropTypes?.[0]);
        setVal('soil-select',       p.soilType);
        setVal('farm-size',         p.farmSizeAcres);
        setCheck('irrigation-toggle', p.hasIrrigation);

        if (p.soilData) {
            setVal('n-value',        p.soilData.nitrogen);
            setVal('p-value',        p.soilData.phosphorus);
            setVal('k-value',        p.soilData.potassium);
            setVal('ph-value',       p.soilData.ph);
            setVal('moisture-value', p.soilData.moisture);
            setVal('rainfall-value', p.soilData.rainfall);
            setVal('temp-value',     p.soilData.temperature);
        }
    } catch (e) { /* ignore */ }
}

// Restore on page load
document.addEventListener('DOMContentLoaded', restoreFarmProfile);

async function getRecommendations() {
  // Save current values before fetching
  saveFarmProfile();

  const lang = 'en';
  const payload = {
    season: document.getElementById('season-select').value,
    state: document.getElementById('state-select').value,
    soilType: document.getElementById('soil-select').value,
    hasIrrigation: document.getElementById('irrigation-toggle').checked,
    farmSizeAcres: parseFloat(document.getElementById('farm-size').value) || 2,
    lat: window.userLat || null,
    lng: window.userLng || null,
    lang
  };

  const resultsContainer = document.getElementById('what-to-grow-results');
  resultsContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Getting AI Recommendations...</div>';

  try {
      const res = await fetch(`${API_BASE}/what-to-grow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      renderRecommendations(data.recommendations || {}, lang);
  } catch(err) {
      console.error(err);
      resultsContainer.innerHTML = '<p>Failed to load recommendations.</p>';
  }
}

function renderRecommendations(data, lang) {
  const container = document.getElementById('what-to-grow-results');
  if (!data.top_crops || data.top_crops.length === 0) {
    container.innerHTML = `<p>${data.advice || 'No recommendations available.'}</p>`;
    return;
  }
  
  // Render rank-1 crop prominently, then rank 2 & 3 smaller
  const cropsHtml = data.top_crops.map((crop, i) => `
    <div class="crop-card rank-${i + 1}" style="border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 15px; background: ${i===0 ? '#e8f5e9' : '#fff'}">
      <div class="crop-rank" style="font-size: 24px;">${['🥇', '🥈', '🥉'][i]}</div>
      <h2>${lang === 'hi' ? (crop.name_hi || crop.name) : crop.name}</h2>
      <div class="crop-confidence badge-${(crop.risk_level||'low').toLowerCase()}" style="font-weight: bold; margin-bottom: 10px;">${crop.confidence} Confidence</div>
      <p class="crop-why">${lang === 'hi' ? (crop.why_suitable_hi || crop.why_suitable) : crop.why_suitable}</p>
      <div class="crop-stats" style="display:flex; gap: 15px; font-size: 14px; margin-bottom: 10px;">
        <span>💧 ${lang === 'hi' ? (crop.water_need_hi || crop.water_need) : crop.water_need}</span>
        <span>⏱ ${crop.days_to_harvest} days</span>
        <span>💰 ${crop.approx_profit_per_acre}</span>
      </div>
      ${crop.market_price_note ? `<p class="price-note" style="color:var(--gov-blue); font-size: 13px;">📊 ${crop.market_price_note}</p>` : ''}
      ${(crop.applicable_schemes && crop.applicable_schemes.length) ? `
        <div class="schemes-tags" style="margin-top: 10px;">
          ${crop.applicable_schemes.map(s => `<span class="scheme-tag" style="background:#e0e0e0; padding:3px 8px; border-radius:4px; font-size:12px; margin-right:5px;">${s}</span>`).join('')}
        </div>` : ''}
    </div>
  `).join('');

  let generalAdviceHtml = '';
  if (data.general_advice) {
      generalAdviceHtml += `<p id="general-advice" style="font-weight:bold; margin-top: 20px;">${lang === 'hi' ? (data.general_advice_hi || data.general_advice) : data.general_advice}</p>`;
  }
  if (data.weather_consideration) {
      generalAdviceHtml += `<p id="weather-note" style="color: #f57c00;">⛅ ${data.weather_consideration}</p>`;
  }

  container.innerHTML = cropsHtml + generalAdviceHtml;
}

window.getRecommendations = getRecommendations;
window.saveFarmProfile = saveFarmProfile;

