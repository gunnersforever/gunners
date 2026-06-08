import argparse
from pathlib import Path

import pandas as pd

from app.backtest import backtest_symbol
from app.config_loader import load_config
from app.db import get_db_conn, init_db


def load_historical_bars(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["timestamp"])
    if "timestamp" not in df.columns:
        raise ValueError(f"Missing timestamp column in {path}")

    df = df.set_index("timestamp")
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    return df.sort_index()


def main():
    parser = argparse.ArgumentParser(description="Backtest opening range strategy from historical CSV files.")
    parser.add_argument("--config", default="config/config.xml", help="Path to config file.")
    parser.add_argument("--data-dir", default="data", help="Directory containing historical CSV files.")
    parser.add_argument("--db", default="trading.db", help="SQLite database path.")
    parser.add_argument("--symbol", default=None, help="Optional single symbol to backtest.")
    args = parser.parse_args()

    cfg = load_config(args.config)
    conn = get_db_conn(args.db)
    init_db(conn)

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    files = sorted(data_dir.glob("*.csv"))
    for path in files:
        symbol = path.stem.upper()
        if args.symbol and symbol != args.symbol.upper():
            continue
        if symbol not in cfg.symbols:
            continue

        df_hist = load_historical_bars(path)
        print(f"Backtesting {symbol} from {path}")
        backtest_symbol(df_hist, symbol, conn, opening_range_minutes=cfg.opening_range_minutes)

    print("Backtest complete.")


if __name__ == "__main__":
    main()
