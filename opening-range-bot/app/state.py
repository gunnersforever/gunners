from dataclasses import dataclass
import pandas as pd
from typing import Optional


class SymbolState:
    """Holds 1-min bars, EMA values, and opening-range info for a ticker."""

    def __init__(self, symbol: str, opening_range_minutes: int = 15):
        self.symbol = symbol
        self.opening_range_minutes = opening_range_minutes
        self.df = pd.DataFrame()
        self.or_high = None
        self.or_low = None
        self.or_done = False
        self.last_signal_time = None


@dataclass
class Signal:
    symbol: str
    timestamp: pd.Timestamp
    side: str  # 'long' or 'short'
    entry: float
    stop: float
    or_high: float
    or_low: float
    ema20: float
    ema50: float
    ema200: float
    reason: str
    bid: Optional[float] = None
    ask: Optional[float] = None
    last_price: Optional[float] = None
    spread_bps: Optional[float] = None
    quote_timestamp: Optional[pd.Timestamp] = None
