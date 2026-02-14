import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchPortfolioFromApi } from './api';

beforeEach(() => {
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchPortfolioFromApi', () => {
  it('returns error and empty list when response is non-ok', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Authorization required' }) });
    const res = await fetchPortfolioFromApi();
    expect(res.error).toBe('Authorization required');
    expect(Array.isArray(res.portfolio)).toBe(true);
    expect(res.portfolio.length).toBe(0);
  });

  it('returns portfolio when response ok', async () => {
    const payload = { portfolio: [{ symbol: 'AAPL', quantity: '1' }] };
    globalThis.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload });
    const res = await fetchPortfolioFromApi();
    expect(res.error).toBe('');
    expect(Array.isArray(res.portfolio)).toBe(true);
    expect(res.portfolio).toEqual(payload.portfolio);
  });
});
