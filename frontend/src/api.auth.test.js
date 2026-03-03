import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loginUser, getCSRFToken, setCSRFToken, clearAuth } from './api';

beforeEach(() => { globalThis.fetch = vi.fn(); });
afterEach(() => { vi.restoreAllMocks(); clearAuth(); });

describe('loginUser', () => {
  it('stores CSRF token when login succeeds', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ csrf_token: 'token123' }) });
    const res = await loginUser('test','pw');
    expect(res.ok).toBe(true);
    // CSRF token should be stored in memory
    expect(getCSRFToken()).toBe('token123');
  });

  it('returns error on bad credentials', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async() => ({ detail: 'Invalid credentials' }) });
    const res = await loginUser('x','y');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Invalid credentials/);
  });

  it('returns the server guidance message when DB is not initialized (503)', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async() => ({ detail: 'Database not initialized. Run `make init-db` or `alembic upgrade head`' }) });
    const res = await loginUser('x','y');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Database not initialized/);
  });
});
