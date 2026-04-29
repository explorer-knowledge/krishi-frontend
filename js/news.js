// ─────────────────────────────────────────────────────
// js/news.js — Regional News & Daily E-Paper
// Depends on: config.js
// ─────────────────────────────────────────────────────

/** Map state name to bilingual header label */
function _getNewsHeader(state) {
    if (window.currentLang === 'en') return `Regional News (${state || 'Your Region'})`;
    
    const ls = (state || '').toLowerCase();
    if (ls.includes('maharashtra'))  return `प्रादेशिक बातम्या (${state})`;
    if (ls.includes('bengal'))       return `আঞ্চলিক সংবাদ (${state})`;
    if (ls.includes('gujarat'))      return `પ્રાદેશિક સમાચાર (${state})`;
    if (ls.includes('karnataka'))    return `ಪ್ರಾದೇಶಿಕ ಸುದ್ದಿ (${state})`;
    if (ls.includes('tamil'))        return `பிராந்திய செய்திகள் (${state})`;
    if (ls.includes('kerala'))       return `പ്രാദേശിക വാർത്തകൾ (${state})`;
    if (ls.includes('punjab'))       return `ਖੇਤਰੀ ਖ਼ਬਰਾਂ (${state})`;
    return `क्षेत्रीय समाचार (${state || 'आपका क्षेत्र'})`;
}

/**
 * Fetch regional agriculture news from the backend and update:
 *  1. The scrolling news ticker list (#regional-news-list)
 *  2. The Daily E-Paper grid (#epaper-content)
 *  3. window.newsContext — for AI advisory prompts
 */
async function updateRegionalNews(state) {
    const newsHeader = document.getElementById('regional-news-header');
    const newsList   = document.getElementById('regional-news-list');
    if (!newsHeader || !newsList) return;

    newsHeader.textContent = _getNewsHeader(state);
    newsList.innerHTML = '<li><span class="time"><i class="fa-solid fa-spinner fa-spin"></i> Loading live news...</span></li>';

    try {
        const res  = await fetch(`${API_BASE}/news?state=${encodeURIComponent(state || 'Madhya Pradesh')}&lang=${window.currentLang}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to fetch news');

        const articles = json.data.articles;
        window.newsContext = articles; // Share with AI advisory & chatbot

        // Scrolling ticker — duplicated for seamless infinite scroll CSS animation
        const listHtml = articles.map(n =>
            `<li class="yojana-item">
                <span style="color:#666;margin-right:6px;">●</span>
                <a href="${n.link}" target="_blank" style="color:inherit;text-decoration:none;">${n.title}</a>
            </li>`
        ).join('');
        newsList.innerHTML = listHtml + listHtml;

        // E-paper grid — uses same data, no extra API call
        renderEPaper(articles);

    } catch (e) {
        console.error('News Error:', e);
        newsList.innerHTML = '<li><span class="time" style="color:red;">Failed to load news. Showing cached data.</span></li>';
    }
}

/**
 * Render the "Krishi Darpan" newspaper-style card grid from article data.
 * Call signature: renderEPaper(articles) — automatically called by updateRegionalNews.
 */
function renderEPaper(articles) {
    const container = document.getElementById('epaper-content');
    if (!container || !articles || articles.length === 0) return;

    const icons  = ['fa-wheat-awn','fa-cloud-sun','fa-seedling','fa-hand-holding-dollar',
                    'fa-tractor','fa-droplet','fa-temperature-half','fa-newspaper'];
    const colors = ['#e3f2fd','#f3e5f5','#e8f5e9','#fff8e1','#fce4ec','#e0f7fa','#fafafa','#f1f8e9'];
    const now    = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });

    const cards = articles.slice(0, 8).map((a, i) => {
        const date = a.publishedAt
            ? new Date(a.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            : now;
        return `
            <div style="background:${colors[i % 8]};border:1px solid #ddd;border-radius:4px;padding:15px;
                        border-top:3px solid var(--gov-blue);">
                <div style="font-size:11px;color:#888;margin-bottom:6px;">
                    <i class="fa-solid ${icons[i % 8]}" style="color:var(--gov-blue);"></i> ${date}
                </div>
                <p style="font-size:13px;font-weight:600;color:#222;line-height:1.5;margin:0;">
                    ${a.link && a.link !== '#'
                        ? `<a href="${a.link}" target="_blank" style="color:#1565c0;">${a.title}</a>`
                        : a.title}
                </p>
            </div>`;
    }).join('');

    container.innerHTML = cards;
}
