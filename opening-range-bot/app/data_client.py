import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import pytz
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


class MarketDataError(Exception):
    pass


class MarketDataClient:
    """Finnhub market data client with retries and local caching."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://finnhub.io/api/v1",
        cache_dir: Optional[Path] = None,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.cache_dir = Path(cache_dir or "data")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def _get(self, endpoint: str, params: Optional[Dict[str, Any]] = None, timeout: int = 10) -> Any:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        query = {"token": self.api_key, **(params or {})}

        try:
            response = self.session.get(url, params=query, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            raise MarketDataError(f"Finnhub request failed for {endpoint}: {exc}") from exc

    def _cache_path(self, symbol: str) -> Path:
        return self.cache_dir / f"{symbol.upper()}_bars.csv"

    def _load_cached_bars(self, symbol: str) -> Optional[pd.DataFrame]:
        path = self._cache_path(symbol)
        if not path.exists():
            return None
        try:
            df = pd.read_csv(path, index_col="timestamp", parse_dates=["timestamp"])
            df.index = df.index.tz_localize("UTC")
            return df.sort_index()
        except Exception as exc:
            logger.warning("Unable to read cached bars for %s: %s", symbol, exc)
            return None

    def _save_cached_bars(self, symbol: str, df: pd.DataFrame) -> None:
        path = self._cache_path(symbol)
        df.to_csv(path, index=True)

    def get_intraday_bars(self, symbol: str, limit: int = 200, interval: str = "1m") -> pd.DataFrame:
        symbol = symbol.upper()
        end_ts = int(time.time())
        start_ts = end_ts - max(limit, 10) * 60
        params = {"symbol": symbol, "resolution": interval, "from": start_ts, "to": end_ts}

        try:
            response = self._get("stock/candle", params=params, timeout=15)
        except MarketDataError as exc:
            cached = self._load_cached_bars(symbol)
            if cached is not None and not cached.empty:
                logger.warning("Using cached bars for %s because live fetch failed: %s", symbol, exc)
                return cached.tail(limit)
            raise

        status = response.get("s")
        if status != "ok":
            if status == "no_data":
                raise MarketDataError(f"Finnhub returned no candle data for {symbol}.")
            raise MarketDataError(f"Finnhub failed to fetch candles for {symbol}: status={status}")

        timestamps = response.get("t", [])
        values = {
            "open": response.get("o", []),
            "high": response.get("h", []),
            "low": response.get("l", []),
            "close": response.get("c", []),
            "volume": response.get("v", []),
        }
        if not timestamps or any(len(values[key]) != len(timestamps) for key in values):
            raise MarketDataError(f"Invalid candle payload for {symbol}.")

        df = pd.DataFrame(values, index=pd.to_datetime(timestamps, unit="s", utc=True))
        df.index.name = "timestamp"
        df = df.sort_index()
        self._save_cached_bars(symbol, df)
        return df.tail(limit)

    def get_best_quote(self, symbol: str) -> Dict[str, Any]:
        symbol = symbol.upper()
        orderbook = self._get("stock/orderbook", {"symbol": symbol}, timeout=10)
        quote = self._get("quote", {"symbol": symbol}, timeout=10)

        best_bid = orderbook.get("bids", [])
        best_ask = orderbook.get("asks", [])

        bid_price = float(best_bid[0][0]) if best_bid else 0.0
        bid_size = float(best_bid[0][1]) if best_bid and len(best_bid[0]) > 1 else 0.0
        ask_price = float(best_ask[0][0]) if best_ask else 0.0
        ask_size = float(best_ask[0][1]) if best_ask and len(best_ask[0]) > 1 else 0.0

        last_price = float(quote.get("c", 0.0)) if quote.get("c") is not None else 0.0
        timestamp = quote.get("t")
        quote_ts = datetime.fromtimestamp(timestamp, tz=pytz.UTC) if timestamp else None

        return {
            "symbol": symbol,
            "bid": bid_price,
            "ask": ask_price,
            "bid_size": bid_size,
            "ask_size": ask_size,
            "last_price": last_price,
            "timestamp": quote_ts,
        }

    def get_last_trade(self, symbol: str, limit: int = 5) -> Dict[str, Any]:
        symbol = symbol.upper()
        response = self._get("stock/trade", {"symbol": symbol}, timeout=10)
        trade_data = response.get("data") if isinstance(response, dict) else response
        if not trade_data:
            raise MarketDataError(f"No recent trade data available for {symbol}.")

        trade_list: List[Any] = trade_data
        last_record = trade_list[-1]

        return {
            "price": float(last_record.get("p", 0.0)),
            "size": float(last_record.get("s", 0.0)),
            "timestamp": pd.to_datetime(last_record.get("t"), unit="s", utc=True),
        }

    def get_symbol_history(self, symbol: str, limit: int = 300) -> pd.DataFrame:
        df = self.get_intraday_bars(symbol, limit=limit)
        if df.empty:
            return df

        df["ema20"] = df["close"].ewm(span=20, adjust=False).mean()
        df["ema50"] = df["close"].ewm(span=50, adjust=False).mean()
        df["ema200"] = df["close"].ewm(span=200, adjust=False).mean()
        return df
