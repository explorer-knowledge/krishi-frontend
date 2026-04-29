async function loadPrices() {
  const stateSelect = document.getElementById('state-select');
  const cropSelect = document.getElementById('crop-select');
  const districtSelect = document.getElementById('district-select');
  const dateFromInput = document.getElementById('date-from');
  const dateToInput = document.getElementById('date-to');
  if(!stateSelect || !cropSelect) return;
 
  const state = stateSelect.value;
  const commodity = cropSelect.value;
  const district = districtSelect ? districtSelect.value : '';
  const fromDate = dateFromInput ? dateFromInput.value : '';
  const toDate = dateToInput ? dateToInput.value : '';
  const lang = window.currentLang || 'en';
 
  // showLoader
  const tableContainer = document.getElementById('prices-table-container');
  if(tableContainer) {
      tableContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
  }
 
  try {
    const res = await fetch(`${API_BASE}/prices?state=${encodeURIComponent(state)}&commodity=${encodeURIComponent(commodity)}&district=${encodeURIComponent(district)}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&limit=30`);
    const data = await res.json();
    renderPriceTable(data.data || [], lang);
  } catch (err) {
    console.error("Error loading prices:", err);
    if(tableContainer) {
        tableContainer.innerHTML = '<p>Failed to load prices data.</p>';
    }
  }
}

function renderPriceTable(records, lang) {
  const tableContainer = document.getElementById('prices-table-container');
  if(!tableContainer) return;

  if (records.length === 0) {
      tableContainer.innerHTML = '<p>No price data found for the selected state and crop.</p>';
      return;
  }

  const headers = lang === 'hi'
    ? ['फसल', 'मंडी', 'जिला', 'न्यूनतम ₹', 'अधिकतम ₹', 'मॉडल ₹', 'तारीख']
    : ['Crop', 'Mandi', 'District', 'Min ₹', 'Max ₹', 'Modal ₹', 'Date'];

  const tbody = records.map(r => `
    <tr>
      <td>${r.commodity} ${r.variety ? `(${r.variety})` : ''}</td>
      <td>${r.market}</td>
      <td>${r.district}</td>
      <td class="price-min">₹${r.minPrice.toLocaleString('en-IN')}</td>
      <td class="price-max">₹${r.maxPrice.toLocaleString('en-IN')}</td>
      <td class="price-modal"><strong>₹${r.modalPrice.toLocaleString('en-IN')}</strong></td>
      <td>${r.date}</td>
    </tr>
  `).join('');

  tableContainer.innerHTML = `
    <table class="prices-table" style="width: 100%; border-collapse: collapse;">
      <thead><tr style="background: var(--gov-blue); color: white;">${headers.map(h => `<th style="padding: 10px; border: 1px solid #ddd;">${h}</th>`).join('')}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  `;
}

async function initPricesPage() {
    try {
        const res = await fetch(`${API_BASE}/prices/meta`);
        const data = await res.json();
        
        const stateSelect = document.getElementById('state-select');
        const cropSelect = document.getElementById('crop-select');
        const districtSelect = document.getElementById('district-select');

        if(stateSelect && data.states) {
            stateSelect.innerHTML = '<option value="">All States / सभी राज्य</option>' + data.states.map(s => `<option value="${s}">${s}</option>`).join('');
            
            // Populate district dropdown when state changes
            if (districtSelect && data.stateDistricts) {
                stateSelect.addEventListener('change', () => {
                    const selectedState = stateSelect.value;
                    const districts = data.stateDistricts[selectedState];
                    
                    if (districts && districts.length > 0) {
                        districtSelect.innerHTML = '<option value="">All Districts / सभी जिले</option>' + districts.map(d => `<option value="${d}">${d}</option>`).join('');
                    } else {
                        districtSelect.innerHTML = '<option value="">All Districts / सभी जिले</option>';
                    }
                    
                    // Reset district selection to trigger full state fetch when user changes state
                    districtSelect.value = '';
                });
            }
        }
        if(cropSelect && data.crops) {
            cropSelect.innerHTML = '<option value="">All Crops / सभी फसलें</option>' + data.crops.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        
        loadPrices();
    } catch(err) {
        console.error("Error loading meta for prices", err);
    }
}

window.loadPrices = loadPrices;
window.initPricesPage = initPricesPage;

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('prices-table-container')) {
        initPricesPage();
    }
});
