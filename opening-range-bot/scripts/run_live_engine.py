from app.config_loader import load_config
from app.data_client import MarketDataClient
from app.live_engine import run_live_engine


def main():
    cfg = load_config("config/config.xml")
    client = MarketDataClient(
        api_key=cfg.finnhub_api_key,
        base_url=cfg.api_base_url,
        cache_dir=cfg.data_cache_dir,
    )
    run_live_engine(cfg, client)


if __name__ == "__main__":
    main()
