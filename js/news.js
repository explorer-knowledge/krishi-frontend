// ─────────────────────────────────────────────────────
// js/news.js — Regional News & Daily E-Paper
// Depends on: config.js
// Regional news section has been removed; news data now only
// feeds window.newsContext (for AI advisory) and the E-Paper panel.
// ─────────────────────────────────────────────────────

/**
 * Fetch regional agriculture news from the backend.
 * Updates: window.newsContext + the E-Paper panel.
 */
async function updateRegionalNews(state) {
    try {
        const res  = await fetch(`${API_BASE}/news?state=${encodeURIComponent(state || 'Madhya Pradesh')}&lang=en`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to fetch news');

        const articles = json.data.articles;
        window.newsContext = articles; // Shared with AI advisory & chatbot

        renderEPaper(articles);
    } catch (e) {
        console.error('News Error:', e);
        const container = document.getElementById('epaper-content');
        if (container) {
            container.innerHTML = `<div style="text-align:center;color:#e53935;padding:20px;">
                <i class="fa-solid fa-triangle-exclamation"></i> Failed to load news.
            </div>`;
        }
    }
}

/**
 * Render ALL articles as vertical scrollable cards inside #epaper-content.
 * The parent #epaper-scroll-area has overflow-y: auto so the user can scroll
 * through as many cards as are returned by the API.
 */
function renderEPaper(articles) {
    const container = document.getElementById('epaper-content');
    if (!container || !articles || articles.length === 0) return;

    const icons  = ['fa-wheat-awn','fa-cloud-sun','fa-seedling','fa-hand-holding-dollar',
                    'fa-tractor','fa-droplet','fa-temperature-half','fa-newspaper'];
    const colors = ['#e3f2fd','#f3e5f5','#e8f5e9','#fff8e1','#fce4ec','#e0f7fa','#fafafa','#f1f8e9'];
    const now    = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });

    // Render ALL articles (not just 8) so the scrollbar is meaningful
    const cards = articles.map((a, i) => {
        const date = a.publishedAt
            ? new Date(a.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            : now;
        return `
            <div style="background:${colors[i % 8]};border:1px solid #dde3f0;border-radius:5px;
                        padding:12px 14px;border-left:3px solid var(--gov-blue);flex-shrink:0;">
                <div style="font-size:11px;color:#888;margin-bottom:5px;">
                    <i class="fa-solid ${icons[i % 8]}" style="color:var(--gov-blue);"></i>
                    &nbsp;${date}
                </div>
                <p style="font-size:13px;font-weight:600;color:#222;line-height:1.5;margin:0;">
                    ${a.link && a.link !== '#'
                        ? `<a href="${a.link}" target="_blank" style="color:#1565c0;text-decoration:none;">${a.title}</a>`
                        : a.title}
                </p>
            </div>`;
    }).join('');

    // Duplicate the cards array to allow a seamless infinite CSS scroll loop
    container.innerHTML = cards + cards;
}
