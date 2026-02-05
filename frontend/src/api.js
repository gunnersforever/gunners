// Simple auth token helpers (stored in localStorage)
const ACCESS_KEY = 'gunners_access_token';
const REFRESH_KEY = 'gunners_refresh_token';
const USER_KEY = 'gunners_user';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) || '';
}
export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || '';
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
export function setTokens(access, refresh, username) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (username) localStorage.setItem(USER_KEY, username);
}
export function getUsername() {
  return localStorage.getItem(USER_KEY) || '';
}

// Try to refresh access token using refresh token
export async function refreshToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const response = await fetch('/api/token/refresh', { method: 'POST', headers: { Authorization: `Bearer ${refresh}` } });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    if (data && data.access_token && data.refresh_token) {
      setTokens(data.access_token, data.refresh_token, getUsername());
      return true;
    }
  } catch (err) {
    /* ignore */
  }
  return false;
}

// Auth-aware fetch wrapper. Retries once after refresh.
export async function authFetch(path, opts = {}) {
  const headers = opts.headers ? { ...opts.headers } : {};
  const access = getAccessToken();
  if (access) headers.Authorization = `Bearer ${access}`;
  const response = await fetch(path, { ...opts, headers });
  if (response.status === 401) {
    // try refresh
    const ok = await refreshToken();
    if (!ok) return response;
    // retry with new token
    const newAccess = getAccessToken();
    headers.Authorization = `Bearer ${newAccess}`;
    return await fetch(path, { ...opts, headers });
  }
  return response;
}

export async function loginUser(username, password) {
  try {
    const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { ok: false, error: data && data.detail ? data.detail : `Server responded ${response.status}` };
    }
    const data = await response.json();
    setTokens(data.access_token, data.refresh_token, username);
    return { ok: true, username, portfolios: data.portfolios || [], active: data.active };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

export async function logoutUser() {
  try {
    await authFetch('/api/logout', { method: 'POST' }).catch(() => {});
  } catch (e) {}
  clearTokens();
}

export async function registerUser(username, password) {
  try {
    const response = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { ok: false, error: data && data.detail ? data.detail : `Server responded ${response.status}` };
    }
    const data = await response.json().catch(() => null);
    return { ok: true, message: data && data.message ? data.message : 'Registered' };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

export async function fetchPortfolioFromApi() {
  try {
    const response = await authFetch('/api/portfolio');
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const detail = data && data.detail ? data.detail : `Server error ${response.status}`;
      return { portfolio: [], error: detail };
    }
    const data = await response.json().catch(() => null);
    return { portfolio: (data && data.portfolio) || [], error: '' };
  } catch (err) {
    return { portfolio: [], error: 'Failed to fetch portfolio' };
  }
}
