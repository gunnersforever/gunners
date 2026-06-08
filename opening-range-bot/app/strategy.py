import pandas as pd
from datetime import time as dtime
from typing import Optional, Dict, Any

from .state import Signal, SymbolState


def update_bars(state: SymbolState, new_bars: pd.DataFrame) -> None:
    if new_bars is None or new_bars.empty:
        return

    df = pd.concat([state.df, new_bars])
    df = df[~df.index.duplicated(keep="last")]
    df = df.sort_index()
    state.df = df.tail(1000)

    if len(state.df) >= 20:
        state.df["ema20"] = state.df["close"].ewm(span=20, adjust=False).mean()
    if len(state.df) >= 50:
        state.df["ema50"] = state.df["close"].ewm(span=50, adjust=False).mean()
    if len(state.df) >= 200:
        state.df["ema200"] = state.df["close"].ewm(span=200, adjust=False).mean()


def update_opening_range(state: SymbolState, session_open_time: pd.Timestamp) -> None:
    if state.or_done or state.df.empty:
        return

    df = state.df.copy()
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    df.index = df.index.tz_convert("US/Eastern")

    or_end = session_open_time + pd.Timedelta(minutes=state.opening_range_minutes)
    in_or = df.loc[(df.index >= session_open_time) & (df.index < or_end)]

    if not in_or.empty:
        state.or_high = float(in_or["high"].max())
        state.or_low = float(in_or["low"].min())

    now = df.index[-1]
    if now >= or_end:
        state.or_done = True


def generate_signal(
    state: SymbolState,
    session_open_time: pd.Timestamp,
    quote: Optional[Dict[str, Any]] = None,
    max_spread_bps: float = 10.0,
) -> Optional[Signal]:
    if state.df.empty or not state.or_done:
        return None

    bar = state.df.iloc[-1]
    ts = bar.name

    ts_local = ts.tz_convert("US/Eastern")
    if ts_local.time() > dtime(hour=10, minute=15):
        return None

    ema20 = bar.get("ema20")
    ema50 = bar.get("ema50")
    ema200 = bar.get("ema200")
    if pd.isna(ema20) or pd.isna(ema50) or pd.isna(ema200):
        return None

    bullish_trend = ema20 > ema50 > ema200 and bar["close"] > ema50
    bearish_trend = ema20 < ema50 < ema200 and bar["close"] < ema50

    spread_bps = None
    if quote:
        mid = (quote["bid"] + quote["ask"]) / 2.0
        if mid <= 0:
            return None
        spread_bps = (quote["ask"] - quote["bid"]) / mid * 10000
        if spread_bps > max_spread_bps:
            return None

    sig: Optional[Signal] = None

    if (
        bullish_trend
        and state.or_high is not None
        and bar["close"] > state.or_high
        and bar["open"] >= state.or_high
    ):
        entry = float(bar["close"])
        stop = float(min(bar["low"], state.or_low))
        sig = Signal(
            symbol=state.symbol,
            timestamp=ts,
            side="long",
            entry=entry,
            stop=stop,
            or_high=state.or_high,
            or_low=state.or_low,
            ema20=float(ema20),
            ema50=float(ema50),
            ema200=float(ema200),
            reason="ORB_long_MA_filtered",
            bid=float(quote["bid"]) if quote else None,
            ask=float(quote["ask"]) if quote else None,
            last_price=float(quote["last_price"]) if quote and quote.get("last_price") is not None else None,
            spread_bps=float(spread_bps) if spread_bps is not None else None,
            quote_timestamp=quote.get("timestamp") if quote else None,
        )

    elif (
        bearish_trend
        and state.or_low is not None
        and bar["close"] < state.or_low
        and bar["open"] <= state.or_low
    ):
        entry = float(bar["close"])
        stop = float(max(bar["high"], state.or_high))
        sig = Signal(
            symbol=state.symbol,
            timestamp=ts,
            side="short",
            entry=entry,
            stop=stop,
            or_high=state.or_high,
            or_low=state.or_low,
            ema20=float(ema20),
            ema50=float(ema50),
            ema200=float(ema200),
            reason="ORB_short_MA_filtered",
            bid=float(quote["bid"]) if quote else None,
            ask=float(quote["ask"]) if quote else None,
            last_price=float(quote["last_price"]) if quote and quote.get("last_price") is not None else None,
            spread_bps=float(spread_bps) if spread_bps is not None else None,
            quote_timestamp=quote.get("timestamp") if quote else None,
        )

    return sig
