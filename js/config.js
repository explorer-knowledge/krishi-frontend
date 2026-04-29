// ─────────────────────────────────────────────────────
// js/config.js — Global constants & shared state
// Loaded FIRST by every page. All other modules depend on this.
// ─────────────────────────────────────────────────────

const API_BASE = 'https://krishi-backend-plfv.onrender.com/api';

window.currentLang = localStorage.getItem('krishi_lang') || 'hi';

window.setLang = function (lang) {
    localStorage.setItem('krishi_lang', lang);
    window.location.reload();
};

// Auto-translate DOM elements that use the "Hindi (English)" format
document.addEventListener('DOMContentLoaded', () => {
    // 1. Hook up the top nav buttons
    document.querySelectorAll('.top-nav-right a').forEach(a => {
        const t = a.textContent.trim();
        if (t === 'English') {
            a.onclick = (e) => { e.preventDefault(); window.setLang('en'); };
            if (window.currentLang === 'en') a.style.fontWeight = 'bold';
        }
        if (t === 'हिन्दी') {
            a.onclick = (e) => { e.preventDefault(); window.setLang('hi'); };
            if (window.currentLang === 'hi') a.style.fontWeight = 'bold';
        }
    });

    // 2. Walk the DOM and replace "Hindi (English)" strings
    const regex = /^\s*(.*?)\s*\((.*?[a-zA-Z].*?)\)\s*([|:]?)\s*$/;
    function processNode(node) {
        if (node.nodeType === 3) { // Text node
            const text = node.nodeValue;
            if (text.includes('(')) {
                const match = text.match(regex);
                if (match) {
                    node.nodeValue = window.currentLang === 'hi'
                        ? match[1] + (match[3] ? ' ' + match[3] : '')
                        : match[2] + (match[3] ? ' ' + match[3] : '');
                }
            }
        } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
            if (node.hasAttribute('placeholder')) {
                const pText = node.getAttribute('placeholder');
                const m = pText.match(regex);
                if (m) node.setAttribute('placeholder', window.currentLang === 'hi' ? m[1] : m[2]);
            }
            if (node.hasAttribute('value') && node.tagName === 'INPUT') {
                const vText = node.getAttribute('value');
                const m = vText.match(regex);
                if (m) node.setAttribute('value', window.currentLang === 'hi' ? m[1] : m[2]);
            }
            Array.from(node.childNodes).forEach(processNode);
        }
    }
    processNode(document.body);
});

// Shared state (attached to window so all modules can access)
window.weatherContext = null;  // { weather, forecast, agri, location }
window.newsContext = null;  // Array of { title, link, publishedAt }
window.farmLat = 23.2599; // Default: Bhopal
window.farmLng = 77.4126;
window.detectedState = null;
window.detectedLocation = null;
