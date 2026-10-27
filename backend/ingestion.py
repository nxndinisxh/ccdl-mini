"""
Market Data Ingestion Module.

Fetches historical and streaming market data using Yahoo Finance (yfinance),
stores raw snapshots into Amazon S3 (or local cache), and publishes ingestion
events into Amazon SQS for asynchronous event-driven processing.
"""

import os
import json
import logging

# Auto-load .env configuration if present
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    with open(_env_path, "r") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ[_k.strip()] = _v.strip()
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MarketIngestion")

DEFAULT_TICKERS = {
    "SP500": "^GSPC",
    "NASDAQ": "^IXIC",
    "GOLD": "GC=F",
    "BONDS": "TLT",
    "BITCOIN": "BTC-USD",
}


def generate_synthetic_market_data(
    days: int = 500, base_price: float = 4500.0, seed: int = 42
) -> pd.DataFrame:
    """
    Generates synthetic multi-regime geometric Brownian motion market data.
    Ensures offline reliability, automated unit testing, and instant demo execution.
    """
    np.random.seed(seed)
    dates = pd.date_range(end=datetime.now(), periods=days, freq="B")

    # Construct synthetic regime switches:
    # 0-150: Bullish low vol
    # 150-250: Overheated rally high vol
    # 250-380: Market crash / bear high vol
    # 380-500: Sideways recovery
    returns = np.zeros(days)
    for i in range(days):
        if i < 150:
            returns[i] = np.random.normal(0.0008, 0.008)  # Low-vol bull
        elif i < 250:
            returns[i] = np.random.normal(0.0015, 0.022)  # High-vol bull
        elif i < 380:
            returns[i] = np.random.normal(-0.0020, 0.028)  # High-vol bear
        else:
            returns[i] = np.random.normal(0.0001, 0.012)  # Sideways

    price_path = base_price * np.exp(np.cumsum(returns))
    volumes = np.random.lognormal(mean=18, sigma=0.5, size=days)

    df = pd.DataFrame(
        {
            "Open": price_path * (1 - 0.002),
            "High": price_path * (1 + 0.005),
            "Low": price_path * (1 - 0.005),
            "Close": price_path,
            "Volume": volumes,
        },
        index=dates,
    )
    df.index.name = "Date"
    return df


def fetch_market_data(
    ticker: str = "^GSPC",
    period: str = "2y",
    interval: str = "1d",
    use_synthetic_fallback: bool = True,
) -> pd.DataFrame:
    """
    Downloads historical market data using yfinance. Falls back to synthetic series
    if offline or if rate limits are encountered.
    """
    try:
        import yfinance as yf

        logger.info(f"Fetching market data for ticker {ticker} (period={period})...")
        ticker_obj = yf.Ticker(ticker)
        df = ticker_obj.history(period=period, interval=interval)

        if df is None or len(df) < 50:
            raise ValueError(f"Insufficient data returned for {ticker}.")

        # Handle MultiIndex columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.dropna(inplace=True)
        return df

    except Exception as exc:
        logger.warning(
            f"Failed to fetch remote market data for {ticker}: {exc}."
        )
        if use_synthetic_fallback:
            logger.info("Falling back to synthetic multi-regime market generator.")
            return generate_synthetic_market_data(days=500)
        raise exc


class CloudDataPipeline:
    """
    Handles cloud-native storage upload to AWS S3 and message dispatching to AWS SQS.
    Gracefully degrades to local filesystem cache when running in offline/local mock mode.
    """

    def __init__(
        self,
        s3_bucket: Optional[str] = None,
        sqs_queue_url: Optional[str] = None,
        aws_region: str = "us-east-1",
    ):
        self.s3_bucket = s3_bucket or os.getenv("S3_BUCKET_NAME")
        self.sqs_queue_url = sqs_queue_url or os.getenv("SQS_QUEUE_URL")
        self.aws_region = aws_region or os.getenv("AWS_REGION", "us-east-1")
        self.s3_client = None
        self.sqs_client = None

        if self.s3_bucket or self.sqs_queue_url:
            try:
                import boto3

                ak = os.getenv("AWS_ACCESS_KEY_ID")
                sk = os.getenv("AWS_SECRET_ACCESS_KEY")
                if ak and sk:
                    session = boto3.Session(aws_access_key_id=ak, aws_secret_access_key=sk, region_name=self.aws_region)
                    self.s3_client = session.client("s3")
                    self.sqs_client = session.client("sqs")
                else:
                    self.s3_client = boto3.client("s3", region_name=self.aws_region)
                    self.sqs_client = boto3.client("sqs", region_name=self.aws_region)
            except Exception as e:
                logger.warning(f"Boto3 cloud client initialization skipped: {e}")

    def save_market_snapshot(
        self, ticker: str, df: pd.DataFrame, local_dir: str = "data"
    ) -> str:
        """
        Persists market snapshot to S3 bucket or local directory as CSV.
        """
        os.makedirs(local_dir, exist_ok=True)
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        clean_ticker = ticker.replace("^", "").replace("=", "")
        filename = f"{clean_ticker}_{timestamp_str}.csv"
        local_path = os.path.join(local_dir, filename)

        df.to_csv(local_path)
        logger.info(f"Market snapshot cached locally at: {local_path}")

        # Upload to S3 if configured
        if self.s3_client and self.s3_bucket:
            s3_key = f"raw_market_data/{clean_ticker}/{filename}"
            try:
                self.s3_client.upload_file(local_path, self.s3_bucket, s3_key)
                logger.info(f"Successfully uploaded snapshot to s3://{self.s3_bucket}/{s3_key}")
                return f"s3://{self.s3_bucket}/{s3_key}"
            except Exception as e:
                logger.error(f"S3 upload error: {e}")

        return local_path

    def publish_ingestion_event(self, event_payload: Dict[str, Any]) -> bool:
        """
        Pushes ingestion event notification to SQS queue to trigger async processing.
        """
        message_body = json.dumps(event_payload, default=str)
        if self.sqs_client and self.sqs_queue_url:
            try:
                response = self.sqs_client.send_message(
                    QueueUrl=self.sqs_queue_url,
                    MessageBody=message_body,
                )
                logger.info(f"SQS Event dispatched. MessageId: {response.get('MessageId')}")
                return True
            except Exception as e:
                logger.error(f"SQS send error: {e}")
                return False

        logger.info(f"Local Event Simulation (SQS bypassed): {event_payload.get('ticker')}")
        return True
