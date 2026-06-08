import sqlite3
from pathlib import Path
from typing import Optional

from .state import Signal


DB_PATH = Path("trading.db")


def get_db_conn(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else DB_PATH
    conn = sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS trade_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT,
            ts TEXT,
            side TEXT,
            entry REAL,
            stop REAL,
            or_high REAL,
            or_low REAL,
            ema20 REAL,
            ema50 REAL,
            ema200 REAL,
            mode TEXT,
            reason TEXT
        );
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signal_id INTEGER,
            symbol TEXT,
            ts_entry TEXT,
            ts_exit TEXT,
            side TEXT,
            qty REAL,
            entry_price REAL,
            exit_price REAL,
            pnl REAL,
            FOREIGN KEY(signal_id) REFERENCES trade_signals(id)
        );
        """
    )
    conn.commit()


def log_signal(conn: sqlite3.Connection, sig: Signal, mode: str = "live") -> int:
    with conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO trade_signals
            (symbol, ts, side, entry, stop, or_high, or_low,
             ema20, ema50, ema200, mode, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                sig.symbol,
                sig.timestamp.isoformat(),
                sig.side,
                sig.entry,
                sig.stop,
                sig.or_high,
                sig.or_low,
                sig.ema20,
                sig.ema50,
                sig.ema200,
                mode,
                sig.reason,
            ),
        )
        return cur.lastrowid
