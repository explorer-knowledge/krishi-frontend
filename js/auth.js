// ─────────────────────────────────────────────────────────────────
// js/auth.js — Session management (cookie + login state + location)
// Loaded on EVERY page via a <script> tag after config.js.
// ─────────────────────────────────────────────────────────────────

const AUTH_COOKIE      = 'krishi_session';
const LOCATION_KEY     = 'krishi_location';
const COOKIE_MAX_DAYS  = 7;          // session valid for 7 days

// ── Cookie helpers ────────────────────────────────────────────────

function _setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; expires=${expires}; path=/; SameSite=Lax`;
}

function _getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    if (!match) return null;
    try { return JSON.parse(decodeURIComponent(match[1])); } catch { return null; }
}

function _deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

// ── Public session API ────────────────────────────────────────────

/**
 * Returns the current session object or null.
 * { mobile, loginAt, maskedMobile }
 */
window.getSession = function () {
    return _getCookie(AUTH_COOKIE);
};

/**
 * Call this after a successful OTP verify to persist the session.
 */
window.saveSession = function (mobile) {
    const session = {
        mobile,
        maskedMobile: mobile.substring(0, 5) + 'XXXXX',
        loginAt: new Date().toISOString(),
    };
    _setCookie(AUTH_COOKIE, session, COOKIE_MAX_DAYS);
    _applyLoggedInState(session);
    return session;
};

/**
 * Logout: delete cookie, reload.
 */
window.logoutSession = function () {
    _deleteCookie(AUTH_COOKIE);
    _deleteCookie('krishi_session');
    window.location.reload();
};

// ── Location persistence ──────────────────────────────────────────

/**
 * Saves location to localStorage and, if logged in, syncs to the DB.
 * Called by geo.js whenever the user's location changes.
 */
window.persistLocation = function (lat, lng, locationName) {
    // 1. ALWAYS save to localStorage — works for every user, every page
    try {
        localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng, locationName, savedAt: Date.now() }));
    } catch (_) {}

    // 2. If user is logged in → also push to DB (fire-and-forget)
    const session = window.getSession();
    if (!session) return;

    fetch(`${API_BASE}/auth/update-location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: session.mobile, lat, lng, locationName })
    }).catch(() => { /* silent */ });
};

/**
 * Returns the last persisted location, or null.
 */
window.getPersistedLocation = function () {
    try {
        const raw = localStorage.getItem(LOCATION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};

// ── UI state: grey out / restore the login button ─────────────────

function _applyLoggedInState(session) {
    // Works for any button with id="portal-login-btn" OR
    // any button whose onclick mentions 'login-modal'
    const allBtns = [
        document.getElementById('portal-login-btn'),
        ...document.querySelectorAll('[onclick*="login-modal"]'),
    ].filter(Boolean);

    allBtns.forEach(btn => {
        btn.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#a5d6a7;"></i>&nbsp;Logged In';
        btn.disabled  = true;
        btn.onclick   = null;
        btn.title     = `Signed in as +91 ${session.maskedMobile}`;
        // Grey out styles
        btn.style.background  = '#78909c';
        btn.style.cursor      = 'not-allowed';
        btn.style.opacity     = '0.82';
        btn.style.boxShadow   = 'none';
        btn.style.pointerEvents = 'none';
    });
}

// ── Bootstrap on every page load ─────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Apply logged-in UI state if session exists
    const session = window.getSession();
    if (session) {
        _applyLoggedInState(session);
    }

    // ALWAYS restore persisted location into window globals (works for all users)
    const loc = window.getPersistedLocation();
    if (loc && loc.lat && loc.lng) {
        window.farmLat          = loc.lat;
        window.farmLng          = loc.lng;
        window.detectedLocation = loc.locationName || null;
    }
});
