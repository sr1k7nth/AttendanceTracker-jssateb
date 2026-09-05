const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function login(usn, password, leaderboardOpt) {
  const data = await request('/scraper/login', {
    method: 'POST',
    body: JSON.stringify({
      usn,
      password,
      leaderboard_opt: leaderboardOpt,
    }),
  });
  localStorage.setItem('token', data.token);
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

export function getUsn() {
  return localStorage.getItem('usn');
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usn');
}
