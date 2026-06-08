import pandas as pd
from datetime import datetime
import pytz
from typing import Optional

from .state import SymbolState
from .strategy import update_bars, update_opening_range, generate_signal
from .db import log_signal


def backtest_symbol(
    df_hist: pd.DataFrame,
    symbol: str,
    conn,
    opening_range_minutes: int = 15,
) -> None:
    """Run a simple backtest for one symbol using 1-min historical bars."""
    eastern = pytz.timezone("US/Eastern")
    session_open = df_hist.index[0].tz_convert(eastern).replace(
        hour=9, minute=30, second=0, microsecond=0
    )
    session_open = session_open.tz_convert("UTC")

    state = SymbolState(symbol, opening_range_minutes)
    open_position: Optional[dict] = None
    signal_id: Optional[int] = None

    for ts, row in df_hist.iterrows():
        update_bars(state, pd.DataFrame([row]).set_index(pd.Index([ts])))
        update_opening_range(state, session_open)

        sig = generate_signal(state, session_open, quote=None)
        if sig and not open_position:
            signal_id = log_signal(conn, sig, mode="backtest")
            open_position = {
                "side": sig.side,
                "entry_price": sig.entry,
                "ts_entry": ts,
                "qty": 1.0,
            }

        if open_position:
            ts_local = ts.tz_convert("US/Eastern")
            if ts_local.time() >= datetime(2000, 1, 1, 10, 15).time():
                exit_price = float(row["close"])
                pnl = (exit_price - open_position["entry_price"]) * (
                    1 if open_position["side"] == "long" else -1
                )

                cur = conn.cursor()
                cur.execute(
                    """
                    INSERT INTO trades
                    (signal_id, symbol, ts_entry, ts_exit, side, qty,
                     entry_price, exit_price, pnl)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        signal_id,
                        symbol,
                        open_position["ts_entry"].isoformat(),
                        ts.isoformat(),
                        open_position["side"],
                        open_position["qty"],
                        open_position["entry_price"],
                        exit_price,
                        pnl,
                    ),
                )
                conn.commit()
                open_position = None
                signal_id = None