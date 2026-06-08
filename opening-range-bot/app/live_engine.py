import logging
import time
from datetime import datetime, time as dtime
from typing import Dict

import pytz

from .config_loader import AppConfig
from .data_client import MarketDataClient
from .state import SymbolState
from .strategy import generate_signal, update_bars, update_opening_range
from .db import get_db_conn, init_db, log_signal

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler())


def run_live_engine(
    config: AppConfig,
    data_client: MarketDataClient,
    db_path: str = "trading.db",
) -> None:
    conn = get_db_conn(db_path)
    init_db(conn)

    states: Dict[str, SymbolState] = {
        s: SymbolState(s, config.opening_range_minutes) for s in config.symbols
    }

    eastern = pytz.timezone("US/Eastern")
    market_end = dtime(hour=10, minute=30)

    while True:
        now_et = datetime.now(eastern)
        session_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)

        if now_et.time() < session_open.time():
            sleep_seconds = min((session_open - now_et).total_seconds(), 60)
            logger.info("Waiting for market open in %s seconds", int(sleep_seconds))
            time.sleep(max(1, sleep_seconds))
            continue

        if now_et.time() > market_end:
            logger.info("Market session ended at %s ET", market_end)
            break

        for symbol, state in states.items():
            try:
                bars = data_client.get_intraday_bars(symbol, limit=200)
                update_bars(state, bars)
                update_opening_range(state, session_open)

                if state.df.empty:
                    continue

                quote = data_client.get_best_quote(symbol)
                sig = generate_signal(
                    state,
                    session_open,
                    quote=quote,
                    max_spread_bps=config.quote_max_spread_bps,
                )

                if sig and (state.last_signal_time is None or sig.timestamp > state.last_signal_time):
                    log_signal(conn, sig, mode="live")
                    state.last_signal_time = sig.timestamp
            except Exception as exc:
                logger.exception("Failed to process %s: %s", symbol, exc)

        time.sleep(30)
