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

test('shows error when /api/portfolio/reset returns non-ok and does not crash', async () => {
  render(<App />);

  // perform login first (login screen is initial)
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r' }) });
  await userEvent.type(screen.getByLabelText(/Username/), 'u');
  await userEvent.type(screen.getByLabelText(/Password/), 'p');
  await userEvent.click(screen.getByRole('button', { name: /Login/i }));

  // wait for the load screen to appear
  await screen.findByText(/Choose an Option/i);

  // Setup next fetch (portfolio reset) to return non-ok
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Authorization required' }) });

  // click Start New Portfolio (should show error but still proceed to main)
  await userEvent.click(screen.getByRole('button', { name: /Start New Portfolio/i }));
  await waitFor(() => expect(screen.getAllByText(/Authorization required/i).length).toBeGreaterThan(0));
  expect(screen.getByText(/No holdings in portfolio/i)).toBeInTheDocument();
});

test('renders empty portfolio when backend returns ok with empty list', async () => {
  render(<App />);
  // perform login first
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r' }) });
  await userEvent.type(screen.getByLabelText(/Username/), 'u');
  await userEvent.type(screen.getByLabelText(/Password/), 'p');
  await userEvent.click(screen.getByRole('button', { name: /Login/i }));
  await screen.findByText(/Choose an Option/i);

  // portfolio reset returns empty ok
  global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ message: 'Started new portfolio', portfolio: [] }) });

  await userEvent.click(screen.getByRole('button', { name: /Start New Portfolio/i }));
  await waitFor(() => expect(screen.getByText(/No holdings in portfolio/i)).toBeInTheDocument());

  // there should be no error text
  expect(screen.queryByText(/Failed|error/i)).toBeNull();
});

test('login -> buy -> sell updates portfolio rows', async () => {
  render(<App />);

  const mockOk = (payload) => ({ ok: true, status: 200, json: async () => payload });

  global.fetch
    .mockResolvedValueOnce(mockOk({ access_token: 'a', refresh_token: 'r' }))
    .mockResolvedValueOnce(mockOk({ message: 'Started new portfolio', portfolio: [] }))
    .mockResolvedValueOnce(mockOk({ price: 100.12 }))
    .mockResolvedValueOnce(mockOk({
      message: 'Bought',
      portfolio: [
        {
          ticker: 'AAPL',
          quantity: '2',
          totalcost: '200.24',
          lasttransactiondate: '2026-02-09T00:00:00Z',
        },
      ],
    }))
    .mockResolvedValueOnce(mockOk({ price: 110.00 }))
    .mockResolvedValueOnce(mockOk({
      message: 'Sold',
      portfolio: [
        {
          ticker: 'AAPL',
          quantity: '1',
          totalcost: '100.12',
          lasttransactiondate: '2026-02-09T01:00:00Z',
        },
      ],
    }));

  await userEvent.type(screen.getByLabelText(/Username/), 'u');
  await userEvent.type(screen.getByLabelText(/Password/), 'p');
  await userEvent.click(screen.getByRole('button', { name: /Login/i }));
  await screen.findByText(/Choose an Option/i);

  await userEvent.click(screen.getByRole('button', { name: /Start New Portfolio/i }));
  await screen.findByText(/No holdings in portfolio/i);

  await userEvent.type(screen.getByLabelText(/Symbol/i), 'AAPL');
  await userEvent.type(screen.getByLabelText(/Quantity/i), '2');
  await userEvent.click(screen.getByRole('button', { name: /Proceed/i }));

  await screen.findByText(/Confirm Buy/i);
  await userEvent.click(screen.getByRole('button', { name: /Confirm/i }));

  await waitFor(() => expect(screen.queryByText(/Confirm Buy/i)).toBeNull());

  await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument());
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(screen.getByText('$200.24')).toBeInTheDocument();
  expect(screen.getByText(/2026-/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Sell/i }));
  await userEvent.clear(screen.getByLabelText(/Symbol/i));
  await userEvent.type(screen.getByLabelText(/Symbol/i), 'AAPL');
  await userEvent.clear(screen.getByLabelText(/Quantity/i));
  await userEvent.type(screen.getByLabelText(/Quantity/i), '1');
  await userEvent.click(screen.getByRole('button', { name: /Proceed/i }));

  await screen.findByText(/Confirm Sell/i);
  await userEvent.click(screen.getByRole('button', { name: /Confirm/i }));

  await waitFor(() => expect(screen.getByText('$100.12')).toBeInTheDocument());
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText(/2026-/)).toBeInTheDocument();
});
