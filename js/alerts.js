// ─────────────────────────────────────────────────────
// js/alerts.js — Twilio SMS/WhatsApp Alert Subscription
// Depends on: config.js
// ─────────────────────────────────────────────────────

/**
 * Handle the alert subscription form submission.
 * Validates the mobile number and POSTs to /api/alerts/subscribe.
 * Called via onsubmit="subscribeAlerts(event)" in index.html.
 */
async function subscribeAlerts(event) {
    event.preventDefault();

    const mobile     = document.getElementById('sub-mobile').value.trim();
    const cropsText  = document.getElementById('sub-crops').value.trim();
    const size       = document.getElementById('sub-size').value;
    const irrigation = document.getElementById('sub-irrigation').value;
    const lang       = document.querySelector('input[name="sub-lang"]:checked').value;
    const waOptIn    = document.getElementById('sub-wa').checked;
    const submitBtn  = document.getElementById('sub-btn');

    // Client-side validation
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
        submitBtn.textContent = 'Invalid Number';
        setTimeout(() => submitBtn.textContent = 'Subscribe', 3000);
        return;
    }

    const cropTypes = cropsText
        ? cropsText.split(',').map(c => c.trim()).filter(Boolean)
        : [];

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Processing...';

    try {
        const res  = await fetch(`${API_BASE}/alerts/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile,
                state:           window.detectedState || 'Unknown',
                location:        { lat: window.farmLat || null, lng: window.farmLng || null },
                whatsappOptIn:   waOptIn,
                cropTypes,
                farmSizeAcres:   size ? parseFloat(size) : null,
                irrigationType:  irrigation,
                preferredLanguage: lang
            })
        });
        const json = await res.json();
        if (json.success) {
            submitBtn.textContent = 'Success!';
            document.getElementById('alert-form').reset();
            setTimeout(() => { submitBtn.disabled = false; submitBtn.textContent = 'Subscribe'; }, 3000);
        } else {
            submitBtn.textContent = 'Error';
            setTimeout(() => { submitBtn.disabled = false; submitBtn.textContent = 'Subscribe'; }, 3000);
        }
    } catch (e) {
        console.error('Subscription Error:', e);
        submitBtn.textContent = 'Network Error';
        setTimeout(() => { submitBtn.disabled = false; submitBtn.textContent = 'Subscribe'; }, 3000);
    }
}
