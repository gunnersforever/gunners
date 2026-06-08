import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional


@dataclass
class AppConfig:
    opening_range_minutes: int
    max_tickers: int
    symbols: List[str]
    finnhub_api_key: str
    api_base_url: str
    data_cache_dir: Path
    quote_max_spread_bps: float


def _get_text(root: ET.Element, path: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    element = root.find(path)
    if element is None or element.text is None or not element.text.strip():
        if required:
            raise ValueError(f"Missing required config value: {path}")
        return default
    return element.text.strip()


def load_config(path: str = "config/config.xml") -> AppConfig:
    cfg_path = Path(path)
    if not cfg_path.exists():
        raise FileNotFoundError(f"Config file not found: {cfg_path}")

    tree = ET.parse(cfg_path)
    root = tree.getroot()

    opening_range_minutes = int(_get_text(root, "./strategy/opening_range_minutes", "15"))
    max_tickers = int(_get_text(root, "./strategy/max_tickers", "10"))
    quote_max_spread_bps = float(_get_text(root, "./strategy/quote_max_spread_bps", "10.0"))

    symbols = [t.attrib.get("symbol", "").strip().upper() for t in root.findall("./tickers/ticker")]
    symbols = [s for s in symbols if s][:max_tickers]
    if not symbols:
        raise ValueError("No ticker symbols configured in <tickers>.")

    api_base_url = _get_text(root, "./api/base_url", "https://finnhub.io/api/v1")
    api_key = os.getenv("FINNHUB_API_KEY") or _get_text(root, "./api/api_key")
    if not api_key:
        raise ValueError(
            "Finnhub API key is required. Set FINNHUB_API_KEY or add <api><api_key>YOUR_KEY</api_key></api> in config."
        )

    cache_dir = Path(_get_text(root, "./cache/data_cache_dir", "data"))
    cache_dir.mkdir(parents=True, exist_ok=True)

    return AppConfig(
        opening_range_minutes=opening_range_minutes,
        max_tickers=max_tickers,
        symbols=symbols,
        finnhub_api_key=api_key,
        api_base_url=api_base_url,
        data_cache_dir=cache_dir,
        quote_max_spread_bps=quote_max_spread_bps,
    )
