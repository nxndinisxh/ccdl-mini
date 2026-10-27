"""
Unsupervised Machine Learning Market Regime Detection Engine.

Implements K-Means clustering on standardized financial feature vectors
to partition market environments into four distinct economic regimes:
1. Low-Volatility Bullish (Stable Expansion)
2. High-Volatility Bullish (Overheated / Momentum)
3. Sideways / Neutral (Consolidation / Range-bound)
4. High-Volatility Bearish (Distress / Market Downturn)
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from features import FEATURE_COLUMNS, extract_market_features

# Pure NumPy implementations of StandardScaler and KMeans
# Guarantees zero DLL / C-extension dependencies, instant startup,
# and complete immunity from OS security / AppLocker DLL blocks.
class PureNumpyScaler:
    def __init__(self):
        self.mean_ = None
        self.scale_ = None

    def fit(self, X):
        X_arr = np.asarray(X, dtype=float)
        self.mean_ = np.nanmean(X_arr, axis=0)
        self.scale_ = np.nanstd(X_arr, axis=0)
        self.scale_[self.scale_ == 0] = 1.0
        return self

    def fit_transform(self, X):
        return self.fit(X).transform(X)

    def transform(self, X):
        X_arr = np.asarray(X, dtype=float)
        return (X_arr - self.mean_) / self.scale_

    def inverse_transform(self, X):
        X_arr = np.asarray(X, dtype=float)
        return (X_arr * self.scale_) + self.mean_


class PureNumpyKMeans:
    def __init__(self, n_clusters: int = 4, max_iter: int = 300, random_state: int = 42, *args, **kwargs):
        self.n_clusters = n_clusters
        self.max_iter = max_iter
        self.random_state = random_state
        self.cluster_centers_ = None
        self.labels_ = None

    def fit(self, X):
        X_arr = np.asarray(X, dtype=float)
        np.random.seed(self.random_state)
        n_samples = X_arr.shape[0]
        
        # Initialize centers with random distinct samples
        init_indices = np.random.choice(n_samples, self.n_clusters, replace=False)
        self.cluster_centers_ = X_arr[init_indices].copy()

        for _ in range(self.max_iter):
            # Compute Euclidean distance to all cluster centers
            # Shape: (n_samples, n_clusters)
            dists = np.linalg.norm(X_arr[:, np.newaxis] - self.cluster_centers_, axis=2)
            labels = np.argmin(dists, axis=1)

            new_centers = np.array([
                X_arr[labels == k].mean(axis=0) if np.any(labels == k) else self.cluster_centers_[k]
                for k in range(self.n_clusters)
            ])

            if np.allclose(self.cluster_centers_, new_centers, atol=1e-4):
                break
            self.cluster_centers_ = new_centers

        self.labels_ = labels
        return self

    def transform(self, X):
        X_arr = np.asarray(X, dtype=float)
        return np.linalg.norm(X_arr[:, np.newaxis] - self.cluster_centers_, axis=2)

    def predict(self, X):
        X_arr = np.asarray(X, dtype=float)
        dists = self.transform(X_arr)
        return np.argmin(dists, axis=1)


KMeans = PureNumpyKMeans
StandardScaler = PureNumpyScaler


REGIME_NAMES = {
    0: "Low-Volatility Bullish",
    1: "High-Volatility Bullish",
    2: "Sideways / Neutral",
    3: "High-Volatility Bearish",
}

REGIME_DESCRIPTIONS = {
    "Low-Volatility Bullish": "Persistent upward trend accompanied by subdued volatility. Favorable environment for broad equity exposure.",
    "High-Volatility Bullish": "Strong upward momentum but with elevated dispersion and volatility spikes. Caution advised against sudden pullbacks.",
    "Sideways / Neutral": "Mean-reverting consolidation phase with lack of decisive directional trend. Balanced, range-trading approach suggested.",
    "High-Volatility Bearish": "Severe downward price pressure combined with elevated volatility and heightened tail risk. Capital preservation is priority.",
}


class MarketRegimeModel:
    def __init__(self, n_clusters: int = 4, random_state: int = 42):
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.scaler = StandardScaler()
        self.kmeans = KMeans(
            n_clusters=n_clusters,
            random_state=random_state,
            n_init=10,
            max_iter=300,
        )
        self.is_fitted = False
        self.cluster_to_regime_map: Dict[int, str] = {}
        self.transition_matrix: Optional[pd.DataFrame] = None

    def _assign_semantic_labels(self, cluster_centers: np.ndarray) -> Dict[int, str]:
        """
        Maps arbitrary KMeans cluster IDs (0 to K-1) to economically meaningful regime names
        based on the physical meaning of their feature centroids.
        Features: ['log_return', 'volatility', 'trend_ratio', 'ema_spread', 'rsi']
        """
        mapping = {}
        # Inverse transform centroids to original feature scale
        orig_centers = self.scaler.inverse_transform(cluster_centers)
        
        # Determine for each cluster:
        # return (idx 0), vol (idx 1), trend (idx 2)
        cluster_stats = []
        for c_id in range(self.n_clusters):
            ret = orig_centers[c_id, 0]
            vol = orig_centers[c_id, 1]
            trend = orig_centers[c_id, 2]
            cluster_stats.append({
                "cluster": c_id,
                "ret": ret,
                "vol": vol,
                "trend": trend,
            })

        # Rank clusters by return and volatility
        # Cluster with lowest return and high volatility = High-Volatility Bearish
        sorted_by_ret = sorted(cluster_stats, key=lambda x: x["ret"])
        bearish_cluster = sorted_by_ret[0]["cluster"]
        mapping[bearish_cluster] = "High-Volatility Bearish"

        remaining = [c for c in cluster_stats if c["cluster"] != bearish_cluster]

        # Highest volatility among remaining = High-Volatility Bullish
        sorted_by_vol = sorted(remaining, key=lambda x: x["vol"], reverse=True)
        high_vol_bullish = sorted_by_vol[0]["cluster"]
        mapping[high_vol_bullish] = "High-Volatility Bullish"

        remaining = [c for c in remaining if c["cluster"] != high_vol_bullish]

        # Of the remaining two, higher trend ratio is Low-Volatility Bullish, other is Sideways
        if remaining[0]["trend"] >= remaining[1]["trend"]:
            mapping[remaining[0]["cluster"]] = "Low-Volatility Bullish"
            mapping[remaining[1]["cluster"]] = "Sideways / Neutral"
        else:
            mapping[remaining[1]["cluster"]] = "Low-Volatility Bullish"
            mapping[remaining[0]["cluster"]] = "Sideways / Neutral"

        return mapping

    def fit(self, features_df: pd.DataFrame) -> "MarketRegimeModel":
        """
        Fits the scaler and K-Means model on extracted features.
        """
        X = features_df[FEATURE_COLUMNS].values
        X_scaled = self.scaler.fit_transform(X)
        self.kmeans.fit(X_scaled)
        self.cluster_to_regime_map = self._assign_semantic_labels(self.kmeans.cluster_centers_)
        self.is_fitted = True

        # Calculate transition matrix
        raw_clusters = self.kmeans.labels_
        regime_sequence = [self.cluster_to_regime_map[c] for c in raw_clusters]
        self._compute_transition_matrix(regime_sequence)

        return self

    def _compute_transition_matrix(self, regime_sequence: List[str]):
        """
        Computes 1-step Markov transition probability matrix between detected regimes.
        """
        unique_regimes = sorted(list(set(regime_sequence)))
        matrix = pd.DataFrame(0.0, index=unique_regimes, columns=unique_regimes)

        for i in range(len(regime_sequence) - 1):
            curr_state = regime_sequence[i]
            next_state = regime_sequence[i + 1]
            matrix.loc[curr_state, next_state] += 1.0

        # Row normalize
        row_sums = matrix.sum(axis=1)
        self.transition_matrix = matrix.div(row_sums.replace(0, 1), axis=0)

    def predict(self, features_df: pd.DataFrame) -> pd.DataFrame:
        """
        Assigns regime labels and cluster distances to feature observations.
        """
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predict() is called.")

        X = features_df[FEATURE_COLUMNS].values
        X_scaled = self.scaler.transform(X)
        raw_preds = self.kmeans.predict(X_scaled)

        result_df = features_df.copy()
        result_df["cluster_id"] = raw_preds
        result_df["regime"] = [self.cluster_to_regime_map[c] for c in raw_preds]
        
        # Calculate distance to assigned cluster centroid (confidence proxy)
        distances = np.min(self.kmeans.transform(X_scaled), axis=1)
        result_df["centroid_distance"] = distances

        return result_df

    def get_cluster_summary(self) -> List[Dict[str, Any]]:
        """
        Returns human-interpretable summary statistics for each detected regime.
        """
        if not self.is_fitted:
            return []

        orig_centers = self.scaler.inverse_transform(self.kmeans.cluster_centers_)
        summaries = []
        for c_id in range(self.n_clusters):
            regime_label = self.cluster_to_regime_map.get(c_id, f"Cluster {c_id}")
            summaries.append({
                "cluster_id": c_id,
                "regime": regime_label,
                "description": REGIME_DESCRIPTIONS.get(regime_label, ""),
                "mean_annualized_volatility": float(orig_centers[c_id, 1]),
                "mean_daily_return_pct": float(orig_centers[c_id, 0] * 100),
                "mean_trend_deviation_pct": float(orig_centers[c_id, 2] * 100),
                "mean_rsi": float(orig_centers[c_id, 4]),
            })
        return summaries
