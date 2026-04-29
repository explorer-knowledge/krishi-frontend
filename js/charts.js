// ─────────────────────────────────────────────────────
// js/charts.js — Chart.js chart initialization
// Depends on: config.js, Chart.js (loaded via CDN)
// ─────────────────────────────────────────────────────

/** 5-year crop yield line chart (Wheat & Soybean, Bhopal region) */
function initYieldChart() {
    const canvas = document.getElementById('yieldChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Gradient fills
    const wg = ctx.createLinearGradient(0, 0, 0, 250);
    wg.addColorStop(0, 'rgba(255,152,0,0.45)');
    wg.addColorStop(0.5, 'rgba(255,183,77,0.15)');
    wg.addColorStop(1, 'rgba(255,152,0,0)');

    const sg = ctx.createLinearGradient(0, 0, 0, 250);
    sg.addColorStop(0, 'rgba(13,71,161,0.4)');
    sg.addColorStop(0.5, 'rgba(100,181,246,0.12)');
    sg.addColorStop(1, 'rgba(13,71,161,0)');

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: ['2019-20', '2020-21', '2021-22', '2022-23', '2023-24'],
            datasets: [
                {
                    label: window.currentLang === 'hi' ? 'गेहूं (टन/हे.)' : 'Wheat (tonnes/ha)',
                    data: [3.2, 3.4, 3.1, 3.8, 4.1],
                    backgroundColor: wg,
                    borderColor: '#ef6c00', borderWidth: 3,
                    tension: 0.4, fill: true,
                    pointBackgroundColor: '#fff', pointBorderColor: '#ef6c00',
                    pointBorderWidth: 2.5, pointRadius: 6, pointHoverRadius: 9
                },
                {
                    label: window.currentLang === 'hi' ? 'सोयाबीन (टन/हे.)' : 'Soybean (tonnes/ha)',
                    data: [1.8, 2.0, 1.6, 2.2, 2.5],
                    backgroundColor: sg,
                    borderColor: '#0d47a1', borderWidth: 3,
                    tension: 0.4, fill: true,
                    pointBackgroundColor: '#fff', pointBorderColor: '#0d47a1',
                    pointBorderWidth: 2.5, pointRadius: 6, pointHoverRadius: 9
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 14, padding: 15, usePointStyle: true, pointStyle: 'circle' } },
                tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, cornerRadius: 4 }
            },
            scales: {
                y: { min: 0.5, max: 5, grid: { color: 'rgba(0,0,0,0.06)' }, title: { display: true, text: 'टन / हेक्टेयर', font: { size: 11 } }, ticks: { font: { size: 11 }, stepSize: 0.5 } },
                x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            }
        }
    });
}

/** 5-day min/max temperature bar chart (rendered after weather data arrives) */
function renderTempChart(fc) {
    const ctx = document.getElementById('tempChart');
    if (!ctx) return;

    const dn = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

    // Destroy previous instance to prevent duplicate charts
    if (window._tempChartInst) { window._tempChartInst.destroy(); }

    window._tempChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: fc.map(f => {
                const d = new Date(f.date);
                const dayStr = window.currentLang === 'hi' ? dn[d.getDay()] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
                return dayStr + ' ' + d.getDate();
            }),
            datasets: [
                { label: window.currentLang === 'hi' ? 'अधिकतम °C' : 'Max °C', data: fc.map(f => Math.round(f.maxTemp)), backgroundColor: 'rgba(211,47,47,0.7)', borderColor: '#d32f2f', borderWidth: 1 },
                { label: window.currentLang === 'hi' ? 'न्यूनतम °C' : 'Min °C', data: fc.map(f => Math.round(f.minTemp)), backgroundColor: 'rgba(21,101,192,0.7)', borderColor: '#1565c0', borderWidth: 1 }
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
