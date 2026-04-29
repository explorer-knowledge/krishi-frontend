// ─────────────────────────────────────────────────────
// js/main.js — Application entry point (index.html only)
// Bootstraps all modules after the DOM is ready.
// Depends on: ALL other js/ modules (loaded before this in HTML)
// ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initGeolocation();   // geo.js  — auto-detect location, render map & trigger weather
    initYieldChart();    // charts.js — render static yield chart
    fetchLiveSchemes();  // schemes.js — populate Yojana scroller
    initChatbotGreeting(); // chatbot.js — show greeting messages
});
