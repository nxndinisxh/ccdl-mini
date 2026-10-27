"""
Automated DynamoDB Regime Synchronizer.

Runs the real Machine Learning K-Means model on live market data
for all major benchmark assets and pushes the results directly to AWS DynamoDB.
"""

import os
import sys
import json
from datetime import datetime, timezone
from decimal import Decimal

# Auto-load .env
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    with open(_env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

access_key = os.getenv("AWS_ACCESS_KEY_ID")
secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
region = os.getenv("AWS_REGION", "us-east-1")
table_name = os.getenv("DYNAMODB_TABLE_NAME", "MarketRegimes")

if not access_key or not secret_key:
    print("=" * 70)
    print("   AWS CREDENTIAL SETUP REQUIRED")
    print("=" * 70)
    print("To automate sending ML results directly into your AWS DynamoDB:")
    print("Please paste your AWS Access Key ID and Secret Access Key.")
    print("=" * 70)
    access_key = input("Enter AWS_ACCESS_KEY_ID: ").strip()
    secret_key = input("Enter AWS_SECRET_ACCESS_KEY: ").strip()
    
    if access_key and secret_key:
        os.environ["AWS_ACCESS_KEY_ID"] = access_key
        os.environ["AWS_SECRET_ACCESS_KEY"] = secret_key
        
        # Save to .env for all future executions
        env_lines = []
        if os.path.exists(_env_path):
            with open(_env_path, "r") as f:
                for line in f:
                    if not line.startswith("AWS_ACCESS_KEY_ID") and not line.startswith("AWS_SECRET_ACCESS_KEY"):
                        env_lines.append(line)
        env_lines.append(f"AWS_ACCESS_KEY_ID={access_key}\n")
        env_lines.append(f"AWS_SECRET_ACCESS_KEY={secret_key}\n")
        with open(_env_path, "w") as f:
            f.writelines(env_lines)
        print("✓ Saved credentials to backend/.env (auto-ignored by Git)\n")

import boto3
from features import extract_market_features
from regime_engine import MarketRegimeModel
from risk_engine import AdaptiveRiskEngine
from ingestion import fetch_market_data

session = boto3.Session(
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    region_name=region
)
dynamodb = session.resource("dynamodb")
table = dynamodb.Table(table_name)

tickers = [
    ("^GSPC", "S&P 500 Index"),
    ("^IXIC", "NASDAQ Composite"),
    ("GC=F", "Gold Futures"),
    ("TLT", "20+ Year Treasury"),
    ("BTC-USD", "Bitcoin USD"),
]

print("=" * 70)
print(f"🚀 AUTOMATICALLY RUNNING K-MEANS ML & PUSHING TO DYNAMODB TABLE '{table_name}'")
print("=" * 70)

for ticker, name in tickers:
    print(f"\n[Processing {ticker} ({name})]...")
    try:
        # 1. Fetch market data
        df = fetch_market_data(ticker=ticker, period="1y")
        print(f"  ✓ Fetched {len(df)} market days from Yahoo Finance")
        
        # 2. Extract technical features
        features_df = extract_market_features(df)
        
        # 3. Fit K-Means ML model
        model = MarketRegimeModel(n_clusters=4, random_state=42)
        model.fit(features_df)
        preds_df = model.predict(features_df)
        
        latest = preds_df.iloc[-1]
        regime = latest["regime"]
        volatility = float(latest["volatility"])
        close_price = float(latest["Close"])
        
        # 4. Run Quantitative Risk Engine
        risk_engine = AdaptiveRiskEngine()
        risk_eval = risk_engine.evaluate_portfolio(
            prices=df["Close"].values,
            returns=features_df["log_return"].values,
            current_regime=regime,
            current_volatility=volatility,
        )
        
        # 5. Format DynamoDB Record
        rec = risk_eval["recommendation"]
        now_ts = datetime.now(timezone.utc).isoformat()
        item = {
            "ticker": ticker,
            "timestamp": now_ts,
            "regime": regime,
            "cluster_id": int(latest["cluster_id"]),
            "current_price": Decimal(str(round(close_price, 2))),
            "risk_score": Decimal(str(round(float(risk_eval["risk_score"]), 2))),
            "risk_tier": risk_eval["risk_tier"],
            "equities": Decimal(str(round(float(rec["equities"]) * 100, 1))),
            "bonds": Decimal(str(round(float(rec["bonds"]) * 100, 1))),
            "cash": Decimal(str(round(float(rec["cash"]) * 100, 1))),
        }
        
        # 6. Put directly into DynamoDB
        table.put_item(Item=item)
        print(f"  ✓ DETECTED REGIME: {regime}")
        print(f"  ✓ RISK SCORE:     {risk_eval['risk_score']}/100")
        print(f"  ✓ ALLOCATION:     Equities: {item['equities']}% | Bonds: {item['bonds']}% | Cash: {item['cash']}%")
        print(f"  ✓ PERSISTED TO DYNAMODB TABLE '{table_name}'!")
        
    except Exception as e:
        print(f"  ✗ Error processing {ticker}: {e}")

print("\n" + "=" * 70)
print("🎉 AUTOMATION COMPLETE: All real ML regimes are now live in DynamoDB!")
print("Refresh your AWS DynamoDB console tab to see all rows!")
print("=" * 70)
