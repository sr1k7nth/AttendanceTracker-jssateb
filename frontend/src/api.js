const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const isForm = options.body instanceof FormData;
  const headers = {
    // FormData needs the browser to set multipart boundary itself
    ...(!isForm && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    const error = new Error(err.detail || `HTTP ${res.status}`);
    error.status = res.status; // callers can branch on HTTP status
    error.detail = err.detail; // machine-readable code, e.g. "recently_scraped"
    error.retryAfter = res.headers.get('Retry-After'); // seconds, when the server sends it
    throw error;
  }

  return res.json();
}

export async function login(usn, password, leaderboardOpt, alias) {
  let data;
  try {
    data = await request('/scraper/login', {
      method: 'POST',
      body: JSON.stringify({
        usn,
        password,
        alias: alias || null,
        leaderboard_opt: leaderboardOpt,
      }),
    });
  } catch (err) {
    // 429 "recently_scraped" = the cooldown gate; everything else passes through.
    if (err.status === 429 && err.detail === 'recently_scraped') {
      return continueFromCooldown(usn, err);
    }
    throw err;
  }
  localStorage.setItem('token', data.token);
  localStorage.setItem('alias', alias);
  localStorage.setItem('leaderboard_opt', JSON.stringify(leaderboardOpt));
  if (data.admin) {
    // Panel creds stay in sessionStorage, so the admin tab is per-tab only.
    localStorage.setItem('usn', data.usn);
    sessionStorage.setItem(
      'panel_creds',
      JSON.stringify({ user: usn.toLowerCase(), pass: password })
    );
    return data;
  }
  sessionStorage.removeItem('panel_creds');
  localStorage.setItem('usn', usn);
  return data;
}

// The cooldown gate answers 429 "recently_scraped" instead of re-scraping a
// USN fetched minutes ago. If this device already holds the token from that
// scrape, the token-authenticated GET serves the same rows — the password was
// verified when that token was issued, so nothing is bypassed. Anything else
// (no token, another USN's token, expired token) is told how long to wait.
async function continueFromCooldown(usn, err) {
  const token = getToken();
  const payload = getTokenPayload();
  if (
    token &&
    payload?.usn &&
    payload.usn.trim().toLowerCase() === usn.trim().toLowerCase()
  ) {
    try {
      // Authoritative: only log the form in if the token really serves this user.
      const data = await fetchAttendance();
      sessionStorage.removeItem('panel_creds');
      localStorage.setItem('usn', usn);
      // Token / alias / leaderboard_opt stay untouched — this attempt's
      // values never reached the portal, so nothing else is written.
      return { token, data, cached: true };
    } catch {
      // Token expired or revoked — fall through to the wait message.
    }
  }
  const secs = Number(err.retryAfter);
  const wait =
    Number.isFinite(secs) && secs > 0
      ? secs < 90
        ? `about ${secs} seconds`
        : `about ${Math.ceil(secs / 60)} minutes`
      : 'a few minutes';
  throw new Error(
    `This portal ID's attendance was fetched just now — try again in ${wait}.`
  );
}

export async function fetchAttendance() {
  return request('/fetch_attendance/');
}

export async function fetchHistory() {
  return request('/fetch_attendance/history');
}

export async function fetchLeaderboard(sort = 'desc', branch = 'ALL') {
  return request(`/leaderboard?sort=${sort}&branch=${branch}`);
}

export function getToken() {
  return localStorage.getItem('token');
}

export function getTokenPayload() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usn');
  sessionStorage.removeItem('panel_creds');
}

// --- donations / supporters -------------------------------------------------

export async function fetchSupporters() {
  return request('/supporters');
}

export async function fetchProgress() {
  return request('/supporters/progress');
}

export async function submitDonation(formData) {
  return request('/donations', { method: 'POST', body: formData });
}

export async function submitFeedback(formData) {
  return request('/feedback', { method: 'POST', body: formData });
}

export async function fetchMyFeedback() {
  return request('/feedback/mine');
}

export async function fetchBetaStatus() {
  return request('/feedback/beta-status');
}

export async function fetchBranches() {
  return request('/feedback/branches');
}

export async function fetchMyDonations() {
  return request('/donations/mine');
}

// --- admin panel — JWT + X-Admin-Auth (base64 panel user:pass) per call -----

function panelHeaders(user, pass) {
  return { 'X-Admin-Auth': btoa(`${user}:${pass}`) };
}

export async function adminListPending(user, pass) {
  return request('/admin/donations/pending', { headers: panelHeaders(user, pass) });
}

export async function adminListReviewed(status, user, pass) {
  return request(`/admin/donations/reviewed?status=${status}`, {
    headers: panelHeaders(user, pass),
  });
}

export async function adminListFeedback(user, pass) {
  return request('/admin/feedback', { headers: panelHeaders(user, pass) });
}

export async function adminReplyFeedback(id, reply, user, pass) {
  return request(`/admin/feedback/${id}/reply`, {
    method: 'POST',
    headers: panelHeaders(user, pass),
    body: JSON.stringify({ reply }),
  });
}

export async function adminListLatest(user, pass) {
  return request('/admin/latest', { headers: panelHeaders(user, pass) });
}

export async function adminApprove(id, amount, user, pass) {
  return request(`/admin/donations/${id}/approve`, {
    method: 'POST',
    headers: panelHeaders(user, pass),
    body: JSON.stringify(amount != null ? { amount } : {}),
  });
}

export async function adminReject(id, user, pass, reason) {
  return request(`/admin/donations/${id}/reject`, {
    method: 'POST',
    headers: panelHeaders(user, pass),
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

export async function fetchAdminScreenshot(id, user, pass) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/admin/donations/${id}/screenshot`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...panelHeaders(user, pass),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    const error = new Error(err.detail || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.blob();
}

export async function fetchAdminFeedbackScreenshot(id, user, pass) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE_URL}/admin/feedback/${id}/screenshot`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...panelHeaders(user, pass),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    const error = new Error(err.detail || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.blob();
}
