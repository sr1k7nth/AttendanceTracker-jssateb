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
    throw error;
  }

  return res.json();
}

export async function login(usn, password, leaderboardOpt, alias) {
  const data = await request('/scraper/login', {
    method: 'POST',
    body: JSON.stringify({
      usn,
      password,
      alias: alias || null,
      leaderboard_opt: leaderboardOpt,
    }),
  });
  localStorage.setItem('token', data.token);
  localStorage.setItem('alias', alias);
  localStorage.setItem('leaderboard_opt', JSON.stringify(leaderboardOpt));
  if (data.admin) {
    // Panel-credential session: the sole key that ever reveals the admin
    // menu/tab. Kept per-tab (sessionStorage), so a normal visit — even on
    // this account — and other tabs never see it. Stored lowercased because
    // the USN field uppercases whatever is typed.
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

export async function fetchAttendance() {
  return request('/fetch_attendance/');
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

export async function refreshAttendance(password) {
  return request('/scraper/refresh', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
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

// --- admin panel — JWT + X-Admin-Auth (base64 panel user:pass) per call -----

function panelHeaders(user, pass) {
  return { 'X-Admin-Auth': btoa(`${user}:${pass}`) };
}

export async function adminListPending(user, pass) {
  return request('/admin/donations/pending', { headers: panelHeaders(user, pass) });
}

export async function adminApprove(id, amount, user, pass) {
  return request(`/admin/donations/${id}/approve`, {
    method: 'POST',
    headers: panelHeaders(user, pass),
    body: JSON.stringify(amount != null ? { amount } : {}),
  });
}

export async function adminReject(id, user, pass) {
  return request(`/admin/donations/${id}/reject`, {
    method: 'POST',
    headers: panelHeaders(user, pass),
    body: JSON.stringify({}),
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
