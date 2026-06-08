# Opening Range MA Bot

Python implementation of an intraday Opening Range Breakout strategy with Finnhub market data, 20/50/200 EMAs, a Streamlit dashboard, and SQLite signal recording.

## Setup

```bash
pip install -r requirements.txt
```

Copy the example configuration and set your Finnhub API key:

```bash
cp config/config.example.xml config/config.xml
```

Then update `config/config.xml` or set the `FINNHUB_API_KEY` environment variable.

## Live engine

```bash
python scripts/run_live_engine.py
```

## Backtest

Place historical 1-minute CSVs (with columns: timestamp, open, high, low, close, volume) into `data/`, then run:

```bash
python scripts/run_backtest.py
```

## Dashboard

```bash
streamlit run ui/streamlit_app.py
```

## Notes

- The engine uses Finnhub `stock/candle`, `stock/orderbook`, and `stock/trade` endpoints for market data.
- Symbol history is cached locally under `data/` to improve resiliency when the API is unavailable.
- The dashboard supports manual Finnhub API key entry via the sidebar if the config file is not used.
