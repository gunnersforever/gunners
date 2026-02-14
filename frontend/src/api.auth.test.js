import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loginUser, getAccessToken, getRefreshToken, clearTokens } from './api';

beforeEach(() => { globalThis.fetch = vi.fn(); });
afterEach(() => { vi.restoreAllMocks(); clearTokens(); });

describe('loginUser', () => {
  it('stores tokens when login succeeds', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a1', refresh_token: 'r1' }) });
    const res = await loginUser('test','pw');
    expect(res.ok).toBe(true);
    expect(getAccessToken()).toBe('a1');
    expect(getRefreshToken()).toBe('r1');
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
