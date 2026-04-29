let conversationHistory = [];
let farmerContext = {};

async function initAdvisory() {
  // We assume an advisory form exists in the HTML where we collect crop, state, etc.
  // If not, we might be calling getAdvisory directly.
  const advisoryForm = document.getElementById('advisory-form');
  if(advisoryForm) {
      advisoryForm.addEventListener('submit', (e) => {
          e.preventDefault();
          getAdvisory();
      });
  }
}

async function getAdvisory() {
  const lang = window.currentLang || 'en';
  
  const cropInput = document.getElementById('advisory-crop');
  const stateInput = document.getElementById('advisory-state');
  
  farmerContext = {
    crop: cropInput ? cropInput.value : 'Wheat',
    state: stateInput ? stateInput.value : 'Madhya Pradesh',
    season: document.getElementById('advisory-season')?.value || 'Rabi',
    soilType: document.getElementById('advisory-soil')?.value || 'Black',
    hasIrrigation: document.getElementById('advisory-irrigation')?.checked || false,
    farmSizeAcres: parseFloat(document.getElementById('advisory-farm-size')?.value) || 2,
    lat: window.userLat || null,
    lng: window.userLng || null,
    lang
  };

  if (!farmerContext.crop || !farmerContext.state) {
    alert(lang === 'hi' ? 'फसल और राज्य आवश्यक हैं' : 'Crop and state are required');
    return;
  }

  const resultsContainer = document.getElementById('advisory-results');
  if(resultsContainer) {
      resultsContainer.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
  }

  try {
      const res = await fetch(`${API_BASE}/advisory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(farmerContext)
      });
      const data = await res.json();

      conversationHistory = []; // Reset history for new advisory
      renderStructuredAdvisory(data.advisory, lang);
      showFollowUpChat();
  } catch(err) {
      console.error(err);
      if(resultsContainer) {
          resultsContainer.innerHTML = '<p>Failed to load advisory.</p>';
      }
  }
}

async function sendFollowUp() {
  const lang = window.currentLang || 'en';
  const followUpInput = document.getElementById('followup-input');
  if(!followUpInput) return;
  const question = followUpInput.value.trim();
  if (!question) return;

  appendChatMessage('user', question);
  followUpInput.value = '';

  conversationHistory.push({ role: 'user', content: question });

  try {
      const res = await fetch(`${API_BASE}/advisory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...farmerContext, followUpQuestion: question, conversationHistory })
      });
      const data = await res.json();
      const answer = data.advisory.followUpAnswer || 'Sorry, I could not answer that.';
      conversationHistory.push({ role: 'assistant', content: answer });
      appendChatMessage('assistant', answer);
  } catch(err) {
      console.error(err);
  }
}

function renderStructuredAdvisory(advisory, lang) {
  const container = document.getElementById('advisory-results');
  if(!container) return;

  if (advisory.raw) {
    container.innerHTML = `<div class="advisory-raw">${advisory.raw}</div>`;
    return;
  }

  const panels = [
    { key: 'todayAction', field: 'action', fieldHi: 'action_hi' },
    { key: 'marketAdvice', field: 'advice', fieldHi: 'advice_hi' },
    { key: 'pestAlert', field: 'alert', fieldHi: 'alert_hi' },
    { key: 'schemeReminder', field: 'scheme', fieldHi: 'scheme_hi' }
  ];

  container.innerHTML = panels.map(p => {
    const panel = advisory[p.key];
    if (!panel) return '';
    return `
      <div class="advisory-panel panel-${p.key}" style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 10px; background: #fafafa;">
        <div class="panel-icon" style="font-size: 24px; margin-bottom: 5px;">${panel.icon || '📋'}</div>
        <h3 style="margin-top: 0;">${lang === 'hi' ? (panel.title_hi || panel.title) : panel.title}</h3>
        <p>${lang === 'hi' ? (panel[p.fieldHi] || panel[p.field]) : panel[p.field]}</p>
        ${p.key === 'pestAlert' && panel.remedy ? `
          <div class="remedy-box" style="background: #ffebee; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 13px;">
            <strong>${lang === 'hi' ? 'उपाय:' : 'Remedy:'}</strong>
            ${lang === 'hi' ? (panel.remedy_hi || panel.remedy) : panel.remedy}
          </div>` : ''}
        ${p.key === 'schemeReminder' && panel.url ? `
          <a href="${panel.url}" target="_blank" class="scheme-link" style="display:inline-block; margin-top: 10px; background: var(--gov-blue); color: #fff; padding: 5px 10px; text-decoration: none; border-radius: 4px;">
            ${lang === 'hi' ? 'आवेदन करें →' : 'Apply →'}
          </a>` : ''}
      </div>
    `;
  }).join('');

  if (advisory.summary) {
      const summaryEl = document.getElementById('advisory-summary');
      if(summaryEl) {
          summaryEl.textContent = lang === 'hi' ? (advisory.summary_hi || advisory.summary) : advisory.summary;
      } else {
          container.innerHTML += `<p style="font-weight:bold; margin-top: 15px;">${lang === 'hi' ? (advisory.summary_hi || advisory.summary) : advisory.summary}</p>`;
      }
  }
}

function showFollowUpChat() {
    const chatContainer = document.getElementById('followup-chat-container');
    if(chatContainer) {
        chatContainer.style.display = 'block';
    }
}

function appendChatMessage(role, content) {
    const messagesEl = document.getElementById('followup-messages');
    if(!messagesEl) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;
    msgDiv.style.marginBottom = '10px';
    msgDiv.style.padding = '8px 12px';
    msgDiv.style.borderRadius = '8px';
    msgDiv.style.maxWidth = '80%';
    msgDiv.style.clear = 'both';
    
    if(role === 'user') {
        msgDiv.style.background = '#e3f2fd';
        msgDiv.style.float = 'right';
    } else {
        msgDiv.style.background = '#f5f5f5';
        msgDiv.style.float = 'left';
    }
    
    msgDiv.textContent = content;
    messagesEl.appendChild(msgDiv);
    
    // Clear floats
    const clearDiv = document.createElement('div');
    clearDiv.style.clear = 'both';
    messagesEl.appendChild(clearDiv);
}

// NOTE: do NOT override window.generateAiAdvisory here.
// That function lives in advisory.js (homepage weather panel) and is called
// automatically by weather.js after weather data loads.
// The functions below are ONLY for the advisory.html dedicated page.
window.initAdvisory = initAdvisory;
window.getAdvisory = getAdvisory;
window.sendFollowUp = sendFollowUp;

document.addEventListener('DOMContentLoaded', () => {
    initAdvisory();
});
