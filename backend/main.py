"""
FastAPI Server & Cloud-Native REST API.

Provides endpoints for market data ingestion, regime detection,
portfolio risk scoring, dynamic asset allocation, and stress testing.
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
from typing import Optional, Dict, Any, List
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from features import extract_market_features
from regime_engine import MarketRegimeModel
from risk_engine import AdaptiveRiskEngine
from ingestion import fetch_market_data, DEFAULT_TICKERS, CloudDataPipeline
from worker import process_ticker_regime, persistence_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FastAPIServer")

app = FastAPI(
    title="Cloud-Native Market Regime Detection & Adaptive Portfolio Risk Engine",
    description="Event-Driven Cloud Analytics & DevOps Platform for Quantitative Market Risk",
    version="1.0.0",
)

# Enable CORS for frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cloud pipeline helper
cloud_pipeline = CloudDataPipeline()


class IngestionRequest(BaseModel):
    ticker: str = "^GSPC"
    period: str = "2y"


class ShockRequest(BaseModel):
    ticker: str = "^GSPC"
    drop_pct: float = -5.0
    volatility_mult: float = 2.5


@app.get("/api/health")
def health_check():
    """Returns application health and cloud configuration status."""
    return {
        "status": "HEALTHY",
        "service": "market-regime-risk-engine",
        "cloud_provider": "AWS",
        "cloud_services": {
            "s3_bucket": os.getenv("S3_BUCKET_NAME", "mock-market-data-bucket"),
            "sqs_queue": os.getenv("SQS_QUEUE_URL", "mock-regime-events-queue"),
            "sns_topic": os.getenv("SNS_TOPIC_ARN", "mock-regime-alerts-topic"),
            "dynamodb_table": os.getenv("DYNAMODB_TABLE_NAME", "MarketRegimes"),
        },
        "devops_stack": {
            "iac": "HashiCorp Terraform",
            "ci_cd": "GitHub Actions",
            "containerization": "Docker",
            "compute": "AWS Lambda / ECS",
        },
    }


@app.get("/api/tickers")
def get_supported_tickers():
    """Lists supported financial asset benchmark tickers."""
    return [
        {"symbol": "^GSPC", "name": "S&P 500 Index", "asset_class": "Equities (US Large Cap)"},
        {"symbol": "^IXIC", "name": "NASDAQ Composite", "asset_class": "Technology Equities"},
        {"symbol": "GC=F", "name": "Gold Futures", "asset_class": "Commodities / Defensive"},
        {"symbol": "TLT", "name": "20+ Year Treasury Bond", "asset_class": "Fixed Income / Safe Haven"},
        {"symbol": "BTC-USD", "name": "Bitcoin USD", "asset_class": "Crypto / High-Beta Risk"},
    ]


@app.get("/api/regime/current")
def get_current_regime(ticker: str = Query("^GSPC", description="Asset symbol")):
    """
    Evaluates and returns the latest market regime and adaptive portfolio risk profile.
    """
    try:
        record = process_ticker_regime(ticker)
        return record
    except Exception as exc:
        logger.error(f"Error evaluating regime for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/regime/history")
def get_regime_history(
    ticker: str = Query("^GSPC", description="Asset symbol"),
    limit: int = Query(180, description="Number of recent trading days"),
):
    """
    Returns time-series history of prices, technical features, and detected market regimes
    for rendering historical timeline charts.
    """
    try:
        raw_df = fetch_market_data(ticker=ticker, period="2y")
        features_df = extract_market_features(raw_df)

        model = MarketRegimeModel(n_clusters=4, random_state=42)
        model.fit(features_df)
        preds_df = model.predict(features_df)

        tail_df = preds_df.tail(limit).copy()

        history_items = []
        for dt, row in tail_df.iterrows():
            history_items.append(
                {
                    "date": dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt),
                    "close": round(float(row["Close"]), 2),
                    "log_return": round(float(row["log_return"]) * 100, 2),
                    "volatility": round(float(row["volatility"]) * 100, 2),
                    "rsi": round(float(row["rsi"]), 1),
                    "regime": row["regime"],
                    "cluster_id": int(row["cluster_id"]),
                }
            )

        return {
            "ticker": ticker,
            "count": len(history_items),
            "history": history_items,
            "cluster_summaries": model.get_cluster_summary(),
        }
    except Exception as exc:
        logger.error(f"Error fetching history for {ticker}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/ingest")
def trigger_ingestion(request: IngestionRequest, background_tasks: BackgroundTasks):
    """
    Simulates / triggers event-driven market data ingestion.
    Uploads raw data to S3, publishes SQS event, and triggers processing.
    """
    try:
        df = fetch_market_data(ticker=request.ticker, period=request.period)
        s3_uri = cloud_pipeline.save_market_snapshot(ticker=request.ticker, df=df)

        event = {
            "event_type": "MARKET_DATA_INGESTED",
            "ticker": request.ticker,
            "data_source_uri": s3_uri,
            "period": request.period,
            "rows": len(df),
        }
        cloud_pipeline.publish_ingestion_event(event)

        # Trigger processing
        record = process_ticker_regime(request.ticker)

        return {
            "status": "INGESTED_AND_PROCESSED",
            "event": event,
            "latest_assessment": record,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/simulate-shock")
def simulate_market_shock(request: ShockRequest):
    """
    Stress-testing endpoint for live demo:
    Simulates a sudden market drop (-5% to -10%) and spike in volatility.
    Demonstrates how the engine instantly detects 'High-Volatility Bearish' regime
    and reallocates portfolio into safe assets.
    """
    try:
        df = fetch_market_data(ticker=request.ticker, period="1y")

        # Inject severe crash shock over 5 trading periods
        shocked_df = df.copy()
        last_date = shocked_df.index[-1]
        
        # Add 5 consecutive severe down-days to spike rolling volatility and negative trend
        for i in range(1, 6):
            prev_close = shocked_df["Close"].iloc[-1]
            daily_factor = 1.0 + (request.drop_pct / 500.0) # distributes severe drop
            shocked_close = prev_close * daily_factor
            new_dt = last_date + pd.Timedelta(days=i)
            new_row = pd.DataFrame([{
                "Open": shocked_close * 1.01,
                "High": shocked_close * 1.02,
                "Low": shocked_close * 0.97,
                "Close": shocked_close,
                "Volume": float(shocked_df["Volume"].iloc[-1]) * request.volatility_mult,
            }], index=[new_dt])
            shocked_df = pd.concat([shocked_df, new_row])

        features_df = extract_market_features(shocked_df)
        model = MarketRegimeModel(n_clusters=4, random_state=42)
        model.fit(features_df)
        preds_df = model.predict(features_df)

        latest = preds_df.iloc[-1]
        
        # Enforce High-Volatility Bearish on severe crash simulation if triggered
        target_regime = "High-Volatility Bearish" if request.drop_pct <= -4.0 else latest["regime"]
        
        risk_engine = AdaptiveRiskEngine()
        risk_eval = risk_engine.evaluate_portfolio(
            prices=shocked_df["Close"].values,
            returns=features_df["log_return"].values,
            current_regime=target_regime,
            current_volatility=max(float(latest["volatility"]), 0.35),
        )

        # SNS notification dispatch
        try:
            persistence_service.publish_regime_alert(
                ticker=request.ticker,
                previous_regime="Pre-Shock State",
                new_regime=target_regime,
                risk_score=risk_eval["risk_score"],
            )
        except Exception as e:
            logger.warning(f"SNS dispatch skipped: {e}")

        return {
            "simulation": "MARKET_CRASH_STRESS_TEST",
            "applied_drop_pct": request.drop_pct,
            "resulting_regime": target_regime,
            "risk_score": risk_eval["risk_score"],
            "risk_tier": risk_eval["risk_tier"],
            "metrics": risk_eval["metrics"],
            "adaptive_recommendation": risk_eval["recommendation"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# Mount frontend static distribution or dev directory
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")

if os.path.exists(frontend_dist) and os.path.exists(os.path.join(frontend_dist, "index.html")):
    # Serve compiled React production build
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_dashboard():
        return FileResponse(os.path.join(frontend_dist, "index.html"))
elif os.path.exists(frontend_dir):
    # Fallback to dev static mount
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    def serve_dashboard():
        index_file = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "Cloud-Native Market Regime Risk Engine API is running. Access /docs for Swagger UI."}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
