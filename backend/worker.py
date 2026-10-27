"""
Event-Driven Worker Module (AWS Lambda / SQS Worker).

Processes asynchronous market data events triggered by SQS or S3,
computes regime classifications and adaptive portfolio risk metrics,
persists state to Amazon DynamoDB, and emits alerts to Amazon SNS.
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
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import numpy as np
import pandas as pd

from features import extract_market_features
from regime_engine import MarketRegimeModel
from risk_engine import AdaptiveRiskEngine
from ingestion import fetch_market_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RegimeWorker")


class CloudPersistenceService:
    """
    Manages state persistence to Amazon DynamoDB and notifications to Amazon SNS.
    Includes in-memory local fallback when running in standalone mode.
    """

    def __init__(
        self,
        dynamodb_table: Optional[str] = None,
        sns_topic_arn: Optional[str] = None,
        aws_region: str = "us-east-1",
    ):
        self.table_name = dynamodb_table or os.getenv(
            "DYNAMODB_TABLE_NAME", "MarketRegimes"
        )
        self.sns_topic_arn = sns_topic_arn or os.getenv("SNS_TOPIC_ARN")
        self.aws_region = aws_region or os.getenv("AWS_REGION", "us-east-1")
        self.dynamodb_client = None
        self.sns_client = None
        self.local_history = []

        if os.getenv("AWS_EXECUTION_ENV") or self.sns_topic_arn:
            try:
                import boto3

                self.dynamodb_client = boto3.resource(
                    "dynamodb", region_name=self.aws_region
                ).Table(self.table_name)
                self.sns_client = boto3.client("sns", region_name=self.aws_region)
            except Exception as e:
                logger.warning(f"AWS Boto3 initialization failed, running in local memory: {e}")

    def save_regime_record(self, record: Dict[str, Any]) -> bool:
        """
        Saves computed regime and risk profile to DynamoDB or local memory.
        """
        self.local_history.append(record)

        if self.dynamodb_client:
            try:
                # DynamoDB requires float conversion to Decimal or float-compatible formats
                self.dynamodb_client.put_item(Item=record)
                logger.info(f"DynamoDB item persisted successfully for {record.get('ticker')}")
                return True
            except Exception as e:
                logger.error(f"Error persisting item to DynamoDB: {e}")
                return False

        logger.info(f"Stored record locally: {record.get('ticker')} | Regime: {record.get('regime')}")
        return True

    def publish_regime_alert(self, ticker: str, previous_regime: str, new_regime: str, risk_score: float) -> bool:
        """
        Publishes real-time alert via Amazon SNS when a high-risk regime change occurs.
        """
        subject = f"[ALERT] Market Regime Shift: {ticker} -> {new_regime}"
        message = (
            f"Automated Risk Alert from Market Regime Engine\n"
            f"----------------------------------------------\n"
            f"Asset Ticker:     {ticker}\n"
            f"Previous Regime:  {previous_regime}\n"
            f"Detected Regime:  {new_regime}\n"
            f"Risk Score:       {risk_score}/100\n"
            f"Timestamp:        {datetime.now(timezone.utc).isoformat()}\n\n"
            f"Recommendation: Review portfolio allocation and adaptive risk exposure immediately."
        )

        if self.sns_client and self.sns_topic_arn:
            try:
                self.sns_client.publish(
                    TopicArn=self.sns_topic_arn,
                    Subject=subject,
                    Message=message,
                )
                logger.info(f"SNS notification sent successfully for {ticker}")
                return True
            except Exception as e:
                logger.error(f"Error dispatching SNS alert: {e}")
                return False

        logger.info(f"SNS Alert Log (Local Mode): {subject}")
        return True


# Global persistence instance
persistence_service = CloudPersistenceService()


def process_ticker_regime(ticker: str = "^GSPC") -> Dict[str, Any]:
    """
    Executes the analytical pipeline for a given ticker:
    1. Ingestion of price history
    2. Extraction of quantitative market features
    3. Unsupervised K-Means clustering & regime classification
    4. Adaptive risk evaluation (VaR, Drawdown, dynamic allocation weights)
    """
    raw_df = fetch_market_data(ticker=ticker, period="2y")
    features_df = extract_market_features(raw_df)

    # Train model on features
    model = MarketRegimeModel(n_clusters=4, random_state=42)
    model.fit(features_df)
    predictions_df = model.predict(features_df)

    latest_row = predictions_df.iloc[-1]
    current_regime = latest_row["regime"]
    current_vol = float(latest_row["volatility"])

    # Risk Engine Assessment
    risk_engine = AdaptiveRiskEngine()
    returns = features_df["log_return"].values
    prices = raw_df["Close"].values

    risk_evaluation = risk_engine.evaluate_portfolio(
        prices=prices,
        returns=returns,
        current_regime=current_regime,
        current_volatility=current_vol,
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "ticker": ticker,
        "timestamp": now_iso,
        "regime": current_regime,
        "cluster_id": int(latest_row["cluster_id"]),
        "current_price": float(latest_row["Close"]),
        "risk_score": float(risk_evaluation["risk_score"]),
        "risk_tier": risk_evaluation["risk_tier"],
        "metrics": risk_evaluation["metrics"],
        "recommendation": risk_evaluation["recommendation"],
        "cluster_summaries": model.get_cluster_summary(),
    }

    # Persist output
    persistence_service.save_regime_record(record)

    # Trigger alert if critical or high-vol bearish
    if current_regime == "High-Volatility Bearish" or risk_evaluation["risk_score"] >= 75.0:
        persistence_service.publish_regime_alert(
            ticker=ticker,
            previous_regime="Previous Assessment",
            new_regime=current_regime,
            risk_score=risk_evaluation["risk_score"],
        )

    return record


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda entrypoint. Can receive direct invocations, SQS event batches, or S3 triggers.
    """
    logger.info(f"Received Lambda event: {json.dumps(event, default=str)}")
    results = []

    # Check for SQS Records
    if "Records" in event:
        for record in event["Records"]:
            try:
                body = record.get("body", "{}")
                payload = json.loads(body) if isinstance(body, str) else body
                ticker = payload.get("ticker", "^GSPC")
                res = process_ticker_regime(ticker)
                results.append(res)
            except Exception as e:
                logger.error(f"Error handling record: {e}")
    else:
        # Direct Invocation
        ticker = event.get("ticker", "^GSPC")
        results.append(process_ticker_regime(ticker))

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"status": "SUCCESS", "processed_records": results}, default=str),
    }


if __name__ == "__main__":
    print("Testing standalone event worker execution...")
    result = process_ticker_regime("^GSPC")
    print(f"Result for {result['ticker']}:")
    print(f"Regime: {result['regime']}")
    print(f"Risk Score: {result['risk_score']} ({result['risk_tier']})")
    print(f"Recommended Equities: {result['recommendation']['target_weights']['equities_pct']}%")
    print(f"Recommended Cash: {result['recommendation']['target_weights']['cash_and_hedges_pct']}%")
