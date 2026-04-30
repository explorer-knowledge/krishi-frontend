// ─────────────────────────────────────────────────────
// js/chatbot.js — Chatbot UI (Groq via backend /api/chat)
// Depends on: config.js
// Loaded by: index.html + all sub-pages
// ─────────────────────────────────────────────────────

let chatHistory = []; // Rolling conversation history (capped at last 10 turns)
let ttsEnabled  = false;

// ── Text-to-Speech ─────────────────────────────────

function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
    if (!clean) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate  = 0.95;
    utter.pitch = 1.0;
    utter.lang  = 'hi-IN';
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith('hi'))
           || voices.find(v => v.lang.startsWith('en-IN'))
           || null;
    if (v) utter.voice = v;
    window.speechSynthesis.speak(utter);
}

function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('tts-toggle');
    if (btn) {
        btn.innerHTML = ttsEnabled
            ? '<i class="fa-solid fa-volume-high"></i>'
            : '<i class="fa-solid fa-volume-xmark"></i>';
        btn.title = ttsEnabled ? 'TTS ON' : 'TTS OFF';
    }
    if (!ttsEnabled) stopSpeaking();
}

// ── Bubble Helpers ─────────────────────────────────

function makeBotBubble(html, rawText) {
    const speakerBtn = `<button onclick="speakText(this.parentElement.dataset.raw)"
        style="background:none;border:none;cursor:pointer;color:#999;font-size:12px;float:right;padding:0 0 0 6px;" title="Listen">
        <i class="fa-solid fa-volume-up"></i></button>`;
    return `<div class="chat-bubble bot-bubble" data-raw="${(rawText || '').replace(/"/g, '&quot;')}">${speakerBtn}${html}</div>`;
}

// ── Initialisation ─────────────────────────────────

function initChatbotGreeting() {
    const mc = document.getElementById('chatbot-messages');
    if (!mc) return;

    const h = new Date().getHours();
    let greeting = '';
    if (h >= 21 || h < 5)  greeting = 'Good night!';
    else if (h < 12)       greeting = 'Good morning!';
    else if (h < 17)       greeting = 'Good afternoon!';
    else                   greeting = 'Good evening!';

    const helpMsg = 'Hello, how may I help you?\n\nAsk me about weather impact, irrigation, pest control, or schemes!';

    mc.innerHTML = makeBotBubble(greeting, greeting)
                 + makeBotBubble(helpMsg.replace('\n\n', '<br><br>'), helpMsg);
    chatHistory.push({ role: 'assistant', content: `${greeting} ${helpMsg}` });

    // Pre-load voices for better TTS response time
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
}

// ── Controls ───────────────────────────────────────

function toggleChatbot()  { document.getElementById('chatbot-window').classList.toggle('chatbot-hidden'); }
function handleChatInput(e) { if (e.key === 'Enter') processChatInput(); }
function sendChatMessage(t) { document.getElementById('chatbot-input').value = t; processChatInput(); }

// ── Main Chat Handler ──────────────────────────────

async function processChatInput() {
    const inp  = document.getElementById('chatbot-input');
    const mc   = document.getElementById('chatbot-messages');
    const text = inp.value.trim();
    if (!text) return;

    // Show user bubble
    mc.innerHTML += `<div class="chat-bubble user-bubble">${text}</div>`;
    inp.value = '';
    mc.scrollTop = mc.scrollHeight;
    chatHistory.push({ role: 'user', content: text });

    // Show typing indicator
    const lid = 'loading-' + Date.now();
    mc.innerHTML += `<div id="${lid}" class="chat-bubble bot-bubble"><i>Typing...</i></div>`;
    mc.scrollTop = mc.scrollHeight;

    // Build context from global state (weather + news)
    const context = window.weatherContext
        ? { ...window.weatherContext, news: window.newsContext || [] }
        : null;

    try {
        const payloadMessages = [
            { role: 'user', content: `CRITICAL INSTRUCTION: Respond ONLY in ${'English'}. Do not use the other language.` },
            ...chatHistory.slice(-10)
        ];

        const res  = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: payloadMessages, context })
        });
        const json = await res.json();
        const le   = document.getElementById(lid);
        if (le) le.remove();

        if (json.success && json.data?.reply) {
            const rawText = json.data.reply;
            chatHistory.push({ role: 'assistant', content: rawText });
            let bt = rawText;
            if (typeof marked !== 'undefined') bt = marked.parse(bt);
            mc.innerHTML += makeBotBubble(bt, rawText);
            if (ttsEnabled) speakText(rawText);
        } else {
            throw new Error(json.error || 'No response from server');
        }
    } catch (e) {
        console.error('Chatbot Error:', e);
        const le = document.getElementById(lid);
        if (le) le.remove();
        mc.innerHTML += makeBotBubble(
            '<span style="color:red;">Error, try again.</span>',
            'Error occurred'
        );
    }
    mc.scrollTop = mc.scrollHeight;
}

// ── Homepage AI Advisory Panel ─────────────────────
window.generateAiAdvisory = async function() {
    const panel = document.getElementById('ai-advisory-content');
    if (!panel) return;
    
    // Check if we have weather context
    if (!window.weatherContext) {
        panel.innerHTML = '<div style="font-size:13px; font-weight:600;">Waiting for weather data</div>';
        return;
    }
    
    panel.innerHTML = '<div style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Generating personalized advice...</div>';
    
    try {
        const langStr = 'English';
        const context = { ...window.weatherContext, news: window.newsContext || [] };
        
        const payloadMessages = [
            { role: 'user', content: `Based on the current weather and location data, give a 3-sentence farming advisory for the major crops in this season. Respond ONLY in ${langStr}. Format the response as a short, practical paragraph without bullet points or greetings.` }
        ];

        const res  = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: payloadMessages, context })
        });
        const json = await res.json();
        
        if (json.success && json.data?.reply) {
            let reply = json.data.reply;
            if (typeof marked !== 'undefined') reply = marked.parse(reply);
            panel.innerHTML = `<div style="text-align:left; font-size:14px; line-height:1.5; color:#333;">${reply}</div>`;
        } else {
            throw new Error(json.error || 'Failed to get advisory');
        }
    } catch (e) {
        console.error('Home Advisory Error:', e);
        panel.innerHTML = '<div style="color:red; font-size:13px;">Advisory unavailable. Please try again later.</div>';
    }
};

window.sendAIAdvisoryQuery = function() {
    const input = document.getElementById('ai-advisory-input');
    if(input && input.value.trim()) {
        const msg = input.value.trim();
        input.value = '';
        const cw = document.getElementById('chatbot-window');
        if(cw && cw.classList.contains('chatbot-hidden')) {
            toggleChatbot();
        }
        sendChatMessage(msg);
    }
};

