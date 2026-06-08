import sqlite3
from pathlib import Path
from typing import Optional

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from app.config_loader import AppConfig, load_config
from app.data_client import MarketDataClient, MarketDataError

DB_PATH = Path("trading.db")
CONFIG_PATH = Path("config/config.xml")


def load_signals() -> pd.DataFrame:
    if not DB_PATH.exists():
        return pd.DataFrame()
    with sqlite3.connect(DB_PATH) as conn:
        df = pd.read_sql_query(
            "SELECT * FROM trade_signals ORDER BY ts DESC",
            conn,
            parse_dates=["ts"],
        )
    return df


def load_symbol_history(symbol: str, client: MarketDataClient) -> pd.DataFrame:
    try:
        return client.get_symbol_history(symbol, limit=350)
    except MarketDataError as exc:
        st.warning(f"Unable to load symbol history: {exc}")
        return pd.DataFrame()


def main():
    st.set_page_config(page_title="Opening Range Signals", layout="wide")
    st.title("Opening Range MA Signals")

    config: Optional[AppConfig] = None
    if CONFIG_PATH.exists():
        try:
            config = load_config(str(CONFIG_PATH))
        except Exception as exc:
            st.sidebar.error("Unable to load config: %s", exc)

    sidebar = st.sidebar
    sidebar.header("Finnhub settings")
    api_key = sidebar.text_input(
        "Finnhub API Key",
        value=config.finnhub_api_key if config else "",
        type="password",
    )
    base_url = sidebar.text_input(
        "Finnhub Base URL",
        value=config.api_base_url if config else "https://finnhub.io/api/v1",
    )

    client: Optional[MarketDataClient] = None
    if api_key:
        try:
            client = MarketDataClient(api_key=api_key, base_url=base_url, cache_dir=Path("data"))
        except Exception as exc:
            st.sidebar.error("Unable to create Finnhub client: %s", exc)

    df_sig = load_signals()
    df_live = df_sig[df_sig["mode"] == "live"] if not df_sig.empty else df_sig
    selected_symbol = None

    col1, col2 = st.columns([2, 3])

    with col1:
        st.subheader("Latest live signals")
        if df_live.empty:
            st.info("No live signals yet.")
        else:
            df_latest = df_live.sort_values("ts").groupby("symbol").tail(1)
            df_latest = df_latest.assign(
                bias=df_latest["side"].map(
                    {"long": "Bullish opportunity", "short": "Bearish opportunity"}
                )
            )
            st.dataframe(
                df_latest[["symbol", "ts", "side", "entry", "stop", "bias"]],
                use_container_width=True,
            )
            symbols = df_latest["symbol"].unique().tolist()
            if symbols:
                selected_symbol = st.selectbox("Select symbol for chart", symbols)

    with col2:
        st.subheader("Symbol details")
        if not selected_symbol:
            st.info("Select a symbol from the latest signal table.")
        elif not client:
            st.warning("Enter a Finnhub API key in the sidebar to load chart and quote data.")
        else:
            df_hist = load_symbol_history(selected_symbol, client)
            if df_hist.empty:
                st.warning("No historical data available for %s.", selected_symbol)
            else:
                quote = None
                last_trade = None
                try:
                    quote = client.get_best_quote(selected_symbol)
                    last_trade = client.get_last_trade(selected_symbol)
                except MarketDataError as exc:
                    st.warning(f"Unable to fetch quote or trade data: {exc}")

                metrics = st.columns(4)
                metrics[0].metric("Last price", f"${quote['last_price']:.2f}" if quote else "n/a")
                spread = (quote["ask"] - quote["bid"]) if quote else 0.0
                metrics[1].metric(
                    "Bid / Ask",
                    f"${quote['bid']:.2f} / ${quote['ask']:.2f}" if quote else "n/a",
                )
                metrics[2].metric("Spread", f"${spread:.4f}" if quote else "n/a")
                metrics[3].metric(
                    "Last trade size",
                    f"{int(last_trade['size'])}" if last_trade else "n/a",
                )

                fig = go.Figure()
                fig.add_trace(
                    go.Candlestick(
                        x=df_hist.index,
                        open=df_hist["open"],
                        high=df_hist["high"],
                        low=df_hist["low"],
                        close=df_hist["close"],
                        name="Price",
                    )
                )
                if "ema20" in df_hist.columns:
                    fig.add_trace(
                        go.Scatter(
                            x=df_hist.index,
                            y=df_hist["ema20"],
                            mode="lines",
                            name="EMA20",
                            line=dict(color="blue", width=1),
                        )
                    )
                if "ema50" in df_hist.columns:
                    fig.add_trace(
                        go.Scatter(
                            x=df_hist.index,
                            y=df_hist["ema50"],
                            mode="lines",
                            name="EMA50",
                            line=dict(color="orange", width=1),
                        )
                    )
                if "ema200" in df_hist.columns:
                    fig.add_trace(
                        go.Scatter(
                            x=df_hist.index,
                            y=df_hist["ema200"],
                            mode="lines",
                            name="EMA200",
                            line=dict(color="purple", width=1),
                        )
                    )

                last_sig = (
                    df_live[df_live["symbol"] == selected_symbol]
                    .sort_values("ts")
                    .tail(1)
                )
                if not last_sig.empty:
                    or_high = float(last_sig["or_high"].iloc[0])
                    or_low = float(last_sig["or_low"].iloc[0])
                    fig.add_hline(y=or_high, line_dash="dash", line_color="green")
                    fig.add_hline(y=or_low, line_dash="dash", line_color="red")

                fig.update_layout(
                    margin=dict(l=10, r=10, t=30, b=10),
                    xaxis_rangeslider_visible=False,
                )
                st.plotly_chart(fig, use_container_width=True)

                with st.expander("Quote details"):
                    if quote:
                        st.json(quote)
                    if last_trade:
                        st.json(last_trade)

    if not df_sig.empty:
        st.markdown("---")
        st.subheader("Signal history")
        st.dataframe(df_sig.head(50), use_container_width=True)


if __name__ == "__main__":
    main()
