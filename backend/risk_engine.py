"""
Adaptive Portfolio Risk Engine Module.

Calculates quantitative risk metrics (Value at Risk, Conditional VaR,
Max Drawdown, Sharpe Ratio) and generates dynamic portfolio allocation
recommendations responsive to the detected market regime.
"""

import numpy as np
import pandas as pd
from scipy.stats import norm
from typing import Dict, Any, List


# Standard Allocation Profiles across Regimes
REGIME_ALLOCATION_PROFILES = {
    "Low-Volatility Bullish": {
        "equities": 0.80,
        "fixed_income": 0.15,
        "cash_and_hedges": 0.05,
        "risk_stance": "Aggressive Growth",
        "action_directive": "Maintain full equity exposure. Low volatility indicates favorable macroeconomic conditions for trend following.",
    },
    "High-Volatility Bullish": {
        "equities": 0.55,
        "fixed_income": 0.30,
        "cash_and_hedges": 0.15,
        "risk_stance": "Cautious Momentum",
        "action_directive": "Trim speculative equity positions. Raise cash buffer to hedge against volatility mean-reversion spikes.",
    },
    "Sideways / Neutral": {
        "equities": 0.40,
        "fixed_income": 0.40,
        "cash_and_hedges": 0.20,
        "risk_stance": "Balanced / Market-Neutral",
        "action_directive": "Rebalance towards market-neutral and income-generating assets. Avoid aggressive directional beta bets.",
    },
    "High-Volatility Bearish": {
        "equities": 0.15,
        "fixed_income": 0.35,
        "cash_and_hedges": 0.50,
        "risk_stance": "Capital Preservation / Defensive",
        "action_directive": "Execute emergency risk de-escalation: reduce equity beta to defensive minimums and prioritize liquidity / cash reserves.",
    },
}


class AdaptiveRiskEngine:
    def __init__(self, risk_free_rate: float = 0.04):
        """
        Args:
            risk_free_rate: Annualized risk-free benchmark rate (e.g., 4% US Treasury yields).
        """
        self.risk_free_rate = risk_free_rate

    def calculate_var(
        self, returns: np.ndarray, confidence_level: float = 0.95
    ) -> float:
        """
        Calculates Historical Value at Risk (VaR) for a given confidence level.
        Returns positive value representing percentage loss threshold.
        """
        if len(returns) == 0:
            return 0.0
        percentile = (1.0 - confidence_level) * 100.0
        var_loss = -np.percentile(returns, percentile)
        return float(max(0.0, var_loss))

    def calculate_cvar(
        self, returns: np.ndarray, confidence_level: float = 0.95
    ) -> float:
        """
        Calculates Conditional Value at Risk (CVaR / Expected Shortfall).
        Measures the expected loss conditional on exceeding the VaR threshold.
        """
        if len(returns) == 0:
            return 0.0
        percentile = (1.0 - confidence_level) * 100.0
        cutoff = np.percentile(returns, percentile)
        tail_losses = returns[returns <= cutoff]
        if len(tail_losses) == 0:
            return float(-cutoff)
        return float(max(0.0, -tail_losses.mean()))

    def calculate_max_drawdown(self, prices: np.ndarray) -> float:
        """
        Calculates Maximum Drawdown (MDD) from a sequence of cumulative asset prices.
        """
        if len(prices) < 2:
            return 0.0
        peak = np.maximum.accumulate(prices)
        drawdown = (prices - peak) / (peak + 1e-9)
        return float(abs(drawdown.min()))

    def calculate_sharpe_ratio(self, returns: np.ndarray) -> float:
        """
        Calculates Annualized Sharpe Ratio assuming 252 trading days.
        """
        if len(returns) < 2:
            return 0.0
        std = np.std(returns)
        if std < 1e-9:
            return 0.0
        daily_rf = (1.0 + self.risk_free_rate) ** (1.0 / 252.0) - 1.0
        excess_returns = returns - daily_rf
        sharpe = (np.mean(excess_returns) / std) * np.sqrt(252.0)
        return float(sharpe)

    def compute_composite_risk_score(
        self,
        current_regime: str,
        annualized_vol: float,
        var_95: float,
        mdd: float,
    ) -> float:
        """
        Generates a normalized composite Risk Score from 0.0 (Minimal Risk) to 100.0 (Severe Risk).
        Weighted composition:
        - Regime base penalty: 40%
        - Volatility factor: 25%
        - Daily VaR 95%: 20%
        - Drawdown factor: 15%
        """
        regime_weights = {
            "Low-Volatility Bullish": 20.0,
            "Sideways / Neutral": 45.0,
            "High-Volatility Bullish": 60.0,
            "High-Volatility Bearish": 90.0,
        }
        base_regime_score = regime_weights.get(current_regime, 50.0)

        # Scale volatility (e.g. 10% vol = 20 pts, 30% vol = 60 pts, >=50% vol = 100 pts)
        vol_score = min(100.0, (annualized_vol / 0.50) * 100.0)

        # Scale VaR (e.g. 1% daily loss = 25 pts, 4% daily loss = 100 pts)
        var_score = min(100.0, (var_95 / 0.04) * 100.0)

        # Scale MDD (e.g. 5% DD = 25 pts, 20% DD = 100 pts)
        mdd_score = min(100.0, (mdd / 0.20) * 100.0)

        composite = (
            0.40 * base_regime_score
            + 0.25 * vol_score
            + 0.20 * var_score
            + 0.15 * mdd_score
        )
        return float(np.clip(composite, 0.0, 100.0))

    def evaluate_portfolio(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        current_regime: str,
        current_volatility: float,
    ) -> Dict[str, Any]:
        """
        Executes end-to-end risk assessment for the portfolio given recent observations.
        """
        var_95 = self.calculate_var(returns, confidence_level=0.95)
        var_99 = self.calculate_var(returns, confidence_level=0.99)
        cvar_95 = self.calculate_cvar(returns, confidence_level=0.95)
        mdd = self.calculate_max_drawdown(prices)
        sharpe = self.calculate_sharpe_ratio(returns)

        risk_score = self.compute_composite_risk_score(
            current_regime=current_regime,
            annualized_vol=current_volatility,
            var_95=var_95,
            mdd=mdd,
        )

        allocation_profile = REGIME_ALLOCATION_PROFILES.get(
            current_regime, REGIME_ALLOCATION_PROFILES["Sideways / Neutral"]
        )

        # Risk severity tag
        if risk_score < 35.0:
            risk_tier = "LOW"
            tier_color = "emerald"
        elif risk_score < 65.0:
            risk_tier = "MODERATE"
            tier_color = "amber"
        elif risk_score < 80.0:
            risk_tier = "ELEVATED"
            tier_color = "orange"
        else:
            risk_tier = "CRITICAL"
            tier_color = "rose"

        return {
            "regime": current_regime,
            "risk_score": round(risk_score, 1),
            "risk_tier": risk_tier,
            "tier_color": tier_color,
            "metrics": {
                "var_95_pct": round(var_95 * 100, 2),
                "var_99_pct": round(var_99 * 100, 2),
                "cvar_95_pct": round(cvar_95 * 100, 2),
                "annualized_volatility_pct": round(current_volatility * 100, 2),
                "max_drawdown_pct": round(mdd * 100, 2),
                "sharpe_ratio": round(sharpe, 2),
            },
            "recommendation": {
                "risk_stance": allocation_profile["risk_stance"],
                "action_directive": allocation_profile["action_directive"],
                "target_weights": {
                    "equities_pct": int(allocation_profile["equities"] * 100),
                    "fixed_income_pct": int(
                        allocation_profile["fixed_income"] * 100
                    ),
                    "cash_and_hedges_pct": int(
                        allocation_profile["cash_and_hedges"] * 100
                    ),
                },
            },
        }
