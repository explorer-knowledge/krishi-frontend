// ─────────────────────────────────────────────────────
// js/charts.js — Chart.js chart initialization
// Depends on: config.js, Chart.js (loaded via CDN)
// ─────────────────────────────────────────────────────

let yieldChartInstance = null;
let currentYieldData = null;
let selectedCrops = new Set(['Wheat', 'Rice']); // default selections

window.fetchYieldData = async function fetchYieldData() {
    const metric = document.getElementById('chart-metric-select')?.value || 'Yield';
    const season = document.getElementById('chart-season-select')?.value || 'Total';
    
    // Default state to Madhya Pradesh, unless location data is available
    let state = 'Madhya Pradesh';
    if (window.detectedState && window.detectedState.toLowerCase() !== 'madhya pradesh') {
        state = 'All India'; // Use all india data for other states
    }

    document.getElementById('chart-status-text').textContent = 'Loading...';
    
    try {
        const res = await fetch(`${API_BASE}/yield?state=${encodeURIComponent(state)}&metric=${encodeURIComponent(metric)}&season=${encodeURIComponent(season)}`);
        const json = await res.json();
        
        if (json.success) {
            currentYieldData = json.data;
            document.getElementById('chart-status-text').textContent = `Showing ${metric} data`;
            document.getElementById('chart-region-text').textContent = json.data.state;
            
            // Render checkboxes
            renderCropCheckboxes(json.data.crops);
            
            // Draw chart
            renderYieldChart();
        } else {
            throw new Error(json.error);
        }
    } catch (e) {
        console.error('Yield Data Error:', e);
        document.getElementById('chart-status-text').textContent = 'Failed to load data';
    }
}

function renderCropCheckboxes(crops) {
    const container = document.getElementById('crop-checkboxes-container');
    if (!container) return;
    
    // Auto-select up to 3 crops if our defaults aren't in this season
    const validSelections = crops.filter(c => selectedCrops.has(c));
    if (validSelections.length === 0 && crops.length > 0) {
        selectedCrops.clear();
        crops.slice(0, 3).forEach(c => selectedCrops.add(c));
    }

    container.innerHTML = crops.map(crop => `
        <label style="display:flex; align-items:center; gap:4px; cursor:pointer; background:#f0f4f8; padding:4px 8px; border-radius:12px; border:1px solid #d0deeb;">
            <input type="checkbox" value="${crop}" ${selectedCrops.has(crop) ? 'checked' : ''} onchange="toggleCropSelection('${crop}', this.checked)">
            ${crop}
        </label>
    `).join('');
}

window.toggleCropSelection = function(crop, isChecked) {
    if (isChecked) {
        selectedCrops.add(crop);
    } else {
        selectedCrops.delete(crop);
    }
    renderYieldChart();
};

const CHART_COLORS = ['#ef6c00', '#0d47a1', '#2e7d32', '#d32f2f', '#6a1b9a', '#00838f', '#f9a825'];

function renderYieldChart() {
    if (!currentYieldData) return;
    const canvas = document.getElementById('yieldChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (yieldChartInstance) {
        yieldChartInstance.destroy();
    }

    const { labels, datasets, metric } = currentYieldData;
    
    // Filter datasets based on selected checkboxes
    const activeDatasets = datasets
        .filter(d => selectedCrops.has(d.crop))
        .map((d, index) => {
            const color = CHART_COLORS[index % CHART_COLORS.length];
            return {
                label: d.crop,
                data: d.data,
                borderColor: color,
                backgroundColor: color + '20', // transparent fill
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 4
            };
        });

    let unit = '';
    if (metric === 'Yield') unit = 'kg/ha';
    if (metric === 'Production') unit = "'000 Tonnes";
    if (metric === 'Area') unit = "'000 Hectares";

    yieldChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: activeDatasets
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12, usePointStyle: true } },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 4 }
            },
            scales: {
                y: { title: { display: true, text: unit }, grid: { color: 'rgba(0,0,0,0.06)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function initYieldChart() {
    fetchYieldData();
}

/** 5-day min/max temperature bar chart (rendered after weather data arrives) */
function renderTempChart(fc) {
    const ctx = document.getElementById('tempChart');
    if (!ctx) return;

    

    // Destroy previous instance to prevent duplicate charts
    if (window._tempChartInst) { window._tempChartInst.destroy(); }

    window._tempChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fc.map(f => {
                const d = new Date(f.date);
                const dayStr = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
                return dayStr + ' ' + d.getDate();
            }),
            datasets: [
                { label: 'Max °C', data: fc.map(f => Math.round(f.maxTemp)), backgroundColor: 'rgba(211,47,47,0.7)', borderColor: '#d32f2f', borderWidth: 1 },
                { label: 'Min °C', data: fc.map(f => Math.round(f.minTemp)), backgroundColor: 'rgba(21,101,192,0.7)', borderColor: '#1565c0', borderWidth: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } } },
            scales: {
                y: { min: 15, max: 50, grid: { color: '#e0e0e0' }, title: { display: true, text: '°C', font: { size: 11 } } },
                x: { grid: { display: false } }
            }
        }
    });
}
