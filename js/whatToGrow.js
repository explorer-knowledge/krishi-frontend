const SEASONS = {
  en: { kharif: 'Kharif (Jun-Oct)', rabi: 'Rabi (Oct-Mar)', zaid: 'Zaid (Mar-Jun)' },
  hi: { kharif: 'खरीफ (जून-अक्टूबर)', rabi: 'रबी (अक्टूबर-मार्च)', zaid: 'जायद (मार्च-जून)' }
};
const SOIL_TYPES = {
  en: ['Black', 'Alluvial', 'Red', 'Sandy', 'Clay'],
  hi: ['काली', 'जलोढ़', 'लाल', 'बलुई', 'चिकनी']
};

async function getRecommendations() {
  const lang = window.currentLang || 'en';
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
        <span>⏱ ${crop.days_to_harvest} ${lang === 'hi' ? 'दिन' : 'days'}</span>
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
