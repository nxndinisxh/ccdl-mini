"""
Feature Engineering Module for Quantitative Market Regime Detection.

Extracts technical and statistical market features from raw OHLCV price series:
- Logarithmic Returns
- Annualized Rolling Volatility
- Trend Deviation (Price vs. 50-day SMA)
- Exponential Moving Average Spread (EMA-20 / EMA-50)
- Relative Strength Index (RSI-14)
- Volume Momentum (Rolling Z-score of trading volume)
"""

import numpy as np
import pandas as pd
from typing import Tuple


def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """
    Computes the Relative Strength Index (RSI) using standard Wilder's smoothing.
    """
    delta = series.diff()
    gain = (delta.where(delta > 0, 0.0)).copy()
    loss = (-delta.where(delta < 0, 0.0)).copy()

    # Exponentially weighted moving averages
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / (avg_loss + 1e-9)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi


def extract_market_features(df: pd.DataFrame, window_vol: int = 21) -> pd.DataFrame:
    """
    Computes statistical and momentum features from price dataframe containing 'Close' and 'Volume'.

    Args:
        df: DataFrame with datetime index and columns ['Close', 'Volume'].
        window_vol: Lookback window for rolling volatility (default: 21 trading days).

    Returns:
        DataFrame with original columns and appended feature columns.
    """
    data = df.copy()

    if "Close" not in data.columns:
        raise ValueError("Input DataFrame must contain 'Close' price column.")

    # 1. Log Returns
    data["log_return"] = np.log(data["Close"] / data["Close"].shift(1))

    # 2. Annualized Rolling Volatility (252 trading days per year)
    data["volatility"] = (
        data["log_return"].rolling(window=window_vol).std() * np.sqrt(252)
    )

    # 3. Simple Moving Averages & Trend Deviation
    data["sma_50"] = data["Close"].rolling(window=50).mean()
    data["trend_ratio"] = (data["Close"] - data["sma_50"]) / data["sma_50"]

    # 4. Moving Average Momentum (EMA 20 vs EMA 50)
    data["ema_20"] = data["Close"].ewm(span=20, adjust=False).mean()
    data["ema_spread"] = (data["ema_20"] - data["sma_50"]) / data["sma_50"]

    # 5. Relative Strength Index (RSI-14)
    data["rsi"] = compute_rsi(data["Close"], period=14)

    # 6. Volume Z-Score (Momentum of trading volume)
    if "Volume" in data.columns and (data["Volume"] > 0).any():
        vol_mean = data["Volume"].rolling(window=window_vol).mean()
        vol_std = data["Volume"].rolling(window=window_vol).std()
        data["volume_zscore"] = (data["Volume"] - vol_mean) / (vol_std + 1e-9)
    else:
        data["volume_zscore"] = 0.0

    # Fill and clean NaNs resulting from rolling windows
    cleaned_df = data.dropna().copy()
    return cleaned_df


FEATURE_COLUMNS = ["log_return", "volatility", "trend_ratio", "ema_spread", "rsi"]
