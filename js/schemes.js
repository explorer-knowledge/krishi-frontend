// schemes.js — loads government schemes and renders them
// Works on index.html (yojana-list) and schemes.html (schemes-container)

const CATEGORY_LABELS = {
  en: {
    all: 'All Schemes', income_support: 'Income Support', insurance: 'Crop Insurance',
    credit: 'Farm Credit', irrigation: 'Irrigation', advisory: 'Soil & Advisory',
    market: 'Market Access', infrastructure: 'Infrastructure', organic: 'Organic Farming'
  },
  hi: {
    all: 'सभी योजनाएं', income_support: 'आय सहायता', insurance: 'फसल बीमा',
    credit: 'किसान ऋण', irrigation: 'सिंचाई', advisory: 'मृदा एवं सलाह',
    market: 'बाजार पहुंच', infrastructure: 'अवसंरचना', organic: 'जैविक खेती'
  }
};

async function loadSchemes(category = 'all') {
  const lang = 'en';
  try {
    const res = await fetch(`${API_BASE}/schemes?lang=${lang}&category=${category}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const schemes = data.schemes || [];

    // Render on schemes-page (schemes.html)
    const fullContainer = document.getElementById('schemes-container');
    if (fullContainer) renderSchemeCards(schemes, lang, fullContainer);

    // Render compact on index.html (yojana panel)
    const yojanaList = document.getElementById('yojana-list');
    if (yojanaList) renderYojanaList(schemes, lang, yojanaList);

  } catch (err) {
    console.error('Error loading schemes:', err);
    const fullContainer = document.getElementById('schemes-container');
    if (fullContainer) fullContainer.innerHTML = '<p style="color:#c62828; padding:10px;">Failed to load schemes. Please try again.</p>';
    const yojanaList = document.getElementById('yojana-list');
    if (yojanaList) yojanaList.innerHTML = '<li class="yojana-item" style="color:#888;">Schemes unavailable. Check connection.</li>';
  }
}

// Full card view for schemes.html
function renderSchemeCards(schemes, lang, container) {
  if (schemes.length === 0) {
    container.innerHTML = '<p>No schemes found.</p>';
    return;
  }
  container.innerHTML = schemes.map(s => `
    <div class="scheme-card" data-category="${s.category}" style="border:1px solid #ddd; border-radius:8px; padding:18px; margin-bottom:15px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,0.07);">
      <div class="scheme-badge" style="display:inline-block; background:var(--gov-blue); color:#fff; font-size:11px; padding:3px 8px; border-radius:4px; margin-bottom:8px;">
        ${CATEGORY_LABELS[lang][s.category] || s.category}
      </div>
      <h3 class="scheme-name" style="margin:0 0 10px; font-size:16px; color:#002147;">${s.name}</h3>
      <div class="scheme-benefit" style="margin-bottom:8px;">
        <span style="font-weight:bold; font-size:12px;">Benefit:</span>
        <p style="margin:4px 0; font-size:13px; color:#444;">${s.benefit}</p>
      </div>
      <div class="scheme-eligibility" style="margin-bottom:12px;">
        <span style="font-weight:bold; font-size:12px;">Eligibility:</span>
        <p style="margin:4px 0; font-size:13px; color:#555;">${s.eligibility}</p>
      </div>
      <a href="${s.apply_url}" target="_blank" rel="noopener" style="display:inline-block; background:var(--gov-saffron,#FF8C00); color:#fff; padding:7px 16px; border-radius:4px; text-decoration:none; font-size:13px; font-weight:bold;">
        Apply Now →
      </a>
    </div>
  `).join('');
}

// Compact list view for index.html yojana panel
function renderYojanaList(schemes, lang, container) {
  if (schemes.length === 0) {
    container.innerHTML = '<li class="yojana-item">No schemes data available.</li>';
    return;
  }
  container.innerHTML = schemes.map(s => `
    <li class="yojana-item" style="padding:10px 0; border-bottom:1px solid #eee; display:flex; align-items:flex-start; gap:10px;">
      <span style="font-size:20px; flex-shrink:0;">🏛</span>
      <div>
        <div style="font-weight:bold; font-size:13px; color:#002147;">${s.name}</div>
        <div style="font-size:12px; color:#555; margin-top:2px;">${s.benefit}</div>
        <a href="${s.apply_url}" target="_blank" style="font-size:11px; color:var(--gov-blue,#1565c0); text-decoration:none;">Apply →</a>
      </div>
    </li>
  `).join('');
}

// Category filter tabs (for schemes.html)
function initCategoryFilters() {
  const lang = 'en';
  const tabsContainer = document.getElementById('scheme-tabs');
  if (!tabsContainer) return;
  const categories = Object.keys(CATEGORY_LABELS.en);
  tabsContainer.innerHTML = categories.map(cat => `
    <button class="tab-btn ${cat === 'all' ? 'active' : ''}" onclick="filterByCategory('${cat}')" style="padding:7px 14px; margin-right:6px; margin-bottom:6px; border:1px solid #ccc; border-radius:4px; cursor:pointer; background:${cat === 'all' ? 'var(--gov-blue)' : '#fff'}; color:${cat === 'all' ? '#fff' : '#333'}; font-size:13px;">
      ${CATEGORY_LABELS[lang][cat]}
    </button>
  `).join('');
}

function filterByCategory(cat) {
  const tabsContainer = document.getElementById('scheme-tabs');
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
      btn.style.background = '#fff';
      btn.style.color = '#333';
      btn.classList.remove('active');
    });
    const targetBtn = Array.from(tabsContainer.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick') === `filterByCategory('${cat}')`);
    if (targetBtn) {
      targetBtn.style.background = 'var(--gov-blue)';
      targetBtn.style.color = '#fff';
      targetBtn.classList.add('active');
    }
  }
  loadSchemes(cat);
}

// Expose to window
window.filterByCategory = filterByCategory;
window.loadSchemes = loadSchemes;
window.initCategoryFilters = initCategoryFilters;

document.addEventListener('DOMContentLoaded', () => {
  // Check if we are on schemes page or index
  const isSchemesFull = document.getElementById('schemes-container');
  if (isSchemesFull) initCategoryFilters();
  loadSchemes();
});
