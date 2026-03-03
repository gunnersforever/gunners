// Auth helpers - now using httpOnly cookies for tokens
// Only store non-sensitive data (username, theme) in localStorage
const USER_KEY = 'gunners_user';
const THEME_KEY = 'gunners_theme_mode';

// CSRF token stored in memory only (not localStorage)
let csrfToken = '';

export function getCSRFToken() {
  return csrfToken;
}

export function setCSRFToken(token) {
  csrfToken = token;
}

export function clearAuth() {
  csrfToken = '';
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(THEME_KEY);
}

export function setThemeMode(themeMode) {
  if (themeMode) localStorage.setItem(THEME_KEY, themeMode);
}

export function getThemeMode() {
  return localStorage.getItem(THEME_KEY) || '';
}

export function getUsername() {
  return localStorage.getItem(USER_KEY) || '';
}

export function setUsername(username) {
  if (username) localStorage.setItem(USER_KEY, username);
}

// Try to refresh access token using refresh token (now in httpOnly cookie)
export async function refreshToken() {
  try {
    const response = await fetch('/api/token/refresh', { 
      method: 'POST',
      credentials: 'include'  // Send cookies
    });
    
    if (!response.ok) return false;
    
    const data = await response.json().catch(() => null);
    if (data && data.csrf_token) {
      setCSRFToken(data.csrf_token);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// Auth-aware fetch wrapper. Retries once after refresh.
// Automatically includes cookies and CSRF token for state-changing operations
export async function authFetch(path, opts = {}) {
  const headers = opts.headers ? { ...opts.headers } : {};
  
  // Add CSRF token for state-changing operations
  const method = (opts.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  // Always include credentials to send cookies
  const response = await fetch(path, { 
    ...opts, 
    headers,
    credentials: 'include'
  });
  
  if (response.status === 401) {
    // Try refresh
    const ok = await refreshToken();
    if (!ok) return response;
    
    // Retry with refreshed token (cookie set automatically)
    // Update CSRF token header
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    
    return await fetch(path, { 
      ...opts, 
      headers,
      credentials: 'include'
    });
  }
  
  return response;
}

export async function loginUser(username, password) {
  try {
    const response = await fetch('/api/login', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ username, password }),
      credentials: 'include'  // Important: receive cookies
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return { ok: false, error: data && data.detail ? data.detail : `Server responded ${response.status}` };
    }
    
    const data = await response.json();
    
    // Store CSRF token and non-sensitive data
    if (data.csrf_token) {
      setCSRFToken(data.csrf_token);
    }
    setUsername(username);
    if (data.theme_mode) setThemeMode(data.theme_mode);
    
    return { 
      ok: true, 
      username, 
      portfolios: data.portfolios || [], 
      active: data.active, 
      theme_mode: data.theme_mode 
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

export async function fetchPreferences() {
  const response = await authFetch('/api/user/preferences');
  if (!response.ok) return { theme_mode: 'light' };
  const data = await response.json().catch(() => null);
  return { theme_mode: (data && data.theme_mode) || 'light' };
}

export async function updatePreferences(preferences) {
  const response = await authFetch('/api/user/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences || {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data && data.detail ? data.detail : `Server responded ${response.status}`);
  }
  const data = await response.json().catch(() => null);
  if (data && data.theme_mode) setThemeMode(data.theme_mode);
  return data;
}

export async function logoutUser() {
  try {
    await authFetch('/api/logout', { method: 'POST' }).catch(() => {});
  } catch {
    // Ignore errors
  }
  clearAuth();
}

export async function registerUser(username, password) {
  try {
    const response = await fetch('/api/register', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });
    
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
  } catch {
    return { portfolio: [], error: 'Failed to fetch portfolio' };
  }
}

export async function fetchAdvisorHistory() {
  const response = await authFetch('/api/advisor/history');
  if (!response.ok) {
    return [];
  }
  const data = await response.json().catch(() => null);
  return (data && data.history) || [];
}
