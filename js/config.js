// ─────────────────────────────────────────────────────
// js/config.js — Global constants & shared state
// Loaded FIRST by every page. All other modules depend on this.
// ─────────────────────────────────────────────────────

const API_BASE = 'http://localhost:5000/api';

// Auto-translate logic removed. Google Translate widget handles it.

// Shared state (attached to window so all modules can access)
window.weatherContext = null;  // { weather, forecast, agri, location }
window.newsContext = null;  // Array of { title, link, publishedAt }
window.farmLat = 23.24782; // Default: Bhopal
window.farmLng = 77.50236;
window.detectedState = null;
window.detectedLocation = null;

// ── MULTILINGUAL GOOGLE TRANSLATE ────────────────────────────────
function translatePage(langCode) {
    // Set cookie for google translate
    document.cookie = `googtrans=/en/${langCode}; path=/;`;
    document.cookie = `googtrans=/en/${langCode}; path=/; domain=${window.location.hostname}`;
    window.location.reload();
}

// Inject Google Translate script dynamically
document.addEventListener('DOMContentLoaded', () => {
    // Add translation initialization function
    window.googleTranslateElementInit = function () {
        new google.translate.TranslateElement({
            pageLanguage: 'en',
            autoDisplay: false,
            includedLanguages: 'en,hi,mr,bn,pa,ta,te,ml,gu,or,doi,as'
        }, 'google_translate_element');
    };

    // Append script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(script);

    // Hide the Google Translate toolbar that pushes the page down but keep the select visible
    const style = document.createElement('style');
    style.innerHTML = `
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        body { top: 0px !important; }
        #google_translate_element select {
            background: var(--gov-blue-light);
            color: white;
            border: 1px solid var(--border-grey);
            padding: 4px;
            border-radius: 4px;
            font-size: 12px;
            outline: none;
        }
        .goog-te-gadget { color: rgba(0,0,0,0.6) !important; font-size: 10px; display: flex; align-items: center; gap: 5px; margin-top: 0; }
    `;
    document.head.appendChild(style);
});
