"""
Unit & Integration Test Suite for Market Regime Detection and Risk Engine.

Tests:
1. Feature Engineering accuracy and boundary constraints
2. Unsupervised K-Means clustering & semantic regime mapping
3. Quantitative Risk Engine (VaR, CVaR, Drawdown, Asset Weights)
4. Event Worker and API Endpoint contract validation
"""

import pytest
import numpy as np
import pandas as pd
from features import extract_market_features, compute_rsi, FEATURE_COLUMNS
from regime_engine import MarketRegimeModel, REGIME_NAMES
from risk_engine import AdaptiveRiskEngine, REGIME_ALLOCATION_PROFILES
from ingestion import generate_synthetic_market_data
from worker import process_ticker_regime


@pytest.fixture
def sample_market_df():
    """Generates synthetic price data for testing."""
    return generate_synthetic_market_data(days=300, base_price=4000.0, seed=123)


def test_rsi_bounds(sample_market_df):
    """Verifies RSI is bounded within [0, 100]."""
    rsi = compute_rsi(sample_market_df["Close"], period=14).dropna()
    assert len(rsi) > 0
    assert (rsi >= 0.0).all()
    assert (rsi <= 100.0).all()


def test_feature_engineering_extraction(sample_market_df):
    """Verifies extracted feature columns, shapes, and absence of NaNs."""
    features_df = extract_market_features(sample_market_df, window_vol=21)

    for col in FEATURE_COLUMNS:
        assert col in features_df.columns, f"Missing feature: {col}"

    assert not features_df[FEATURE_COLUMNS].isna().any().any()
    # Volatility must be strictly non-negative
    assert (features_df["volatility"] >= 0.0).all()


def test_kmeans_regime_clustering(sample_market_df):
    """Verifies K-Means model fitting, prediction, and semantic labels."""
    features_df = extract_market_features(sample_market_df)
    model = MarketRegimeModel(n_clusters=4, random_state=42)
    model.fit(features_df)

    assert model.is_fitted
    assert len(model.cluster_to_regime_map) == 4

    preds = model.predict(features_df)
    assert "regime" in preds.columns
    assert "cluster_id" in preds.columns
    assert len(preds) == len(features_df)

    # Check cluster summary outputs
    summaries = model.get_cluster_summary()
    assert len(summaries) == 4
    for item in summaries:
        assert "regime" in item
        assert "mean_annualized_volatility" in item


def test_risk_engine_calculations():
    """Tests mathematical correctness of VaR, CVaR, and Drawdown."""
    engine = AdaptiveRiskEngine()

    # Normal distribution with mean 0, std 0.01
    np.random.seed(42)
    returns = np.random.normal(0.0005, 0.015, size=500)
    prices = 100.0 * np.exp(np.cumsum(returns))

    var_95 = engine.calculate_var(returns, confidence_level=0.95)
    var_99 = engine.calculate_var(returns, confidence_level=0.99)
    cvar_95 = engine.calculate_cvar(returns, confidence_level=0.95)
    mdd = engine.calculate_max_drawdown(prices)

    assert var_95 > 0.0
    assert var_99 >= var_95, "VaR 99% must be greater than or equal to VaR 95%"
    assert cvar_95 >= var_95, "CVaR (Expected Shortfall) must exceed VaR"
    assert 0.0 <= mdd <= 1.0, "Max Drawdown must be bounded within [0, 1]"


def test_portfolio_allocation_profiles():
    """Verifies that all regime asset allocation weights sum to exactly 100%."""
    for regime, profile in REGIME_ALLOCATION_PROFILES.items():
        total_weight = (
            profile["equities"]
            + profile["fixed_income"]
            + profile["cash_and_hedges"]
        )
        assert pytest.approx(total_weight, 0.001) == 1.0, f"Weights do not sum to 1.0 in {regime}"

    # Verify Bearish regime has defensive posture
    bearish_profile = REGIME_ALLOCATION_PROFILES["High-Volatility Bearish"]
    assert bearish_profile["equities"] <= 0.20
    assert bearish_profile["cash_and_hedges"] >= 0.40


def test_composite_risk_score_bounds():
    """Verifies that composite risk scores remain between 0 and 100."""
    engine = AdaptiveRiskEngine()

    low_risk = engine.compute_composite_risk_score(
        current_regime="Low-Volatility Bullish",
        annualized_vol=0.08,
        var_95=0.008,
        mdd=0.02,
    )
    high_risk = engine.compute_composite_risk_score(
        current_regime="High-Volatility Bearish",
        annualized_vol=0.45,
        var_95=0.045,
        mdd=0.25,
    )

    assert 0.0 <= low_risk <= 100.0
    assert 0.0 <= high_risk <= 100.0
    assert high_risk > low_risk, "Bearish high volatility scenario must produce higher risk score"


def test_end_to_end_worker_pipeline():
    """Verifies full execution of feature extraction, regime detection, and risk scoring."""
    result = process_ticker_regime("^GSPC")
    assert "regime" in result
    assert "risk_score" in result
    assert "recommendation" in result
    assert "target_weights" in result["recommendation"]
    weights = result["recommendation"]["target_weights"]
    assert (
        weights["equities_pct"]
        + weights["fixed_income_pct"]
        + weights["cash_and_hedges_pct"]
        == 100
    )
