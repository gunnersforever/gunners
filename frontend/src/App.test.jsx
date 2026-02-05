import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, test, expect } from 'vitest';
import React from 'react';
import App from './App';

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('shows error when /api/portfolio returns non-ok and does not crash', async () => {
  render(<App />);

  // perform login first (login screen is initial)
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r' }) });
  await userEvent.type(screen.getByLabelText(/Username/), 'u');
  await userEvent.type(screen.getByLabelText(/Password/), 'p');
  await userEvent.click(screen.getByRole('button', { name: /Login/i }));

  // wait for the load screen to appear
  await screen.findByText(/Choose an Option/i);

  // Setup next fetch (portfolio) to return non-ok
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Authorization required' }) });

  // click Start New Portfolio which sets screen to 'main' and triggers fetchPortfolio
  await userEvent.click(screen.getByRole('button', { name: /Start New Portfolio/i }));
  // wait for the UI to update
  await waitFor(() => expect(screen.getByText(/No holdings in portfolio/i)).toBeInTheDocument());

  // error message should be shown
  expect(screen.getByText(/Authorization required/i)).toBeInTheDocument();
});

test('renders empty portfolio when backend returns ok with empty list', async () => {
  render(<App />);
  // perform login first
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r' }) });
  await userEvent.type(screen.getByLabelText(/Username/), 'u');
  await userEvent.type(screen.getByLabelText(/Password/), 'p');
  await userEvent.click(screen.getByRole('button', { name: /Login/i }));
  await screen.findByText(/Choose an Option/i);

  // portfolio fetch returns empty ok
  global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ portfolio: [] }) });

  await userEvent.click(screen.getByRole('button', { name: /Start New Portfolio/i }));
  await waitFor(() => expect(screen.getByText(/No holdings in portfolio/i)).toBeInTheDocument());

  // there should be no error text
  expect(screen.queryByText(/Failed|error/i)).toBeNull();
});
