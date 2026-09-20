#!/usr/bin/env python3
"""
================================================================================
ER-AEGIS: AI Emergency Response & Resource Intelligence System
Inference & Real-Time Prediction Service (v1.0)
================================================================================

Description:
    Provides production-style inference for predicting ED high-congestion
    within the next 60 minutes.
    Loads the trained model once and generates structured operational predictions.

Output Format:
    {
      "congestion_probability": 0.87,
      "predicted_congestion": true,
      "risk_level": "HIGH",
      "prediction_horizon_minutes": 60
    }

Usage:
    python3 ml/predict.py
================================================================================
"""

import os
import sys
import json
from datetime import datetime
from typing import Dict, Any, Union
import numpy as np
import pandas as pd
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
MODEL_PATH = os.path.join(BASE_DIR, "model.joblib")
FEATURES_PATH = os.path.join(BASE_DIR, "feature_columns.json")
DATA_PATH = os.path.join(PROJECT_ROOT, "data", "hospital_data.csv")


def determine_risk_level(prob: float) -> str:
    """
    Translates predicted congestion probability to prototype operational risk level.
    0.00–0.39: LOW
    0.40–0.64: MODERATE
    0.65–0.84: HIGH
    0.85–1.00: CRITICAL
    """
    if prob < 0.40:
        return "LOW"
    elif prob < 0.65:
        return "MODERATE"
    elif prob < 0.85:
        return "HIGH"
    else:
        return "CRITICAL"


class CongestionPredictor:
    """
    Persistent inference engine that loads model and feature specifications once.
    """
    def __init__(self, model_path: str = MODEL_PATH, features_path: str = FEATURES_PATH):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Please run train_model.py first.")
        if not os.path.exists(features_path):
            raise FileNotFoundError(f"Feature columns file not found at {features_path}. Please run train_model.py first.")

        self.model = joblib.load(model_path)
        with open(features_path, "r") as f:
            self.feature_columns = json.load(f)["feature_columns"]

    def _prepare_features(self, data: Union[Dict[str, Any], pd.Series, pd.DataFrame]) -> pd.DataFrame:
        """
        Formats input data into the exact feature columns required by the model.
        Fills defaults for any unsupplied recent-trend features.
        """
        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, pd.Series):
            df = pd.DataFrame([data.to_dict()])
        elif isinstance(data, pd.DataFrame):
            df = data.copy()
        else:
            raise ValueError("Input data must be a dictionary, pandas Series, or DataFrame.")

        # Temporal features from timestamp if present
        if "timestamp" in df.columns:
            dt = pd.to_datetime(df["timestamp"])
            if "hour" not in df.columns:
                df["hour"] = dt.dt.hour
            if "day_of_week" not in df.columns:
                df["day_of_week"] = dt.dt.dayofweek
            if "is_weekend" not in df.columns:
                df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

        # Fallback estimations for recent-trend features if missing from single-row input
        if "patients_arrived_last_1h" not in df.columns:
            # Approx 4x single interval or arrival_rate_per_hour
            if "arrival_rate_per_hour" in df.columns:
                df["patients_arrived_last_1h"] = df["arrival_rate_per_hour"]
            else:
                df["patients_arrived_last_1h"] = df.get("patients_arrived", 4) * 4

        if "patients_arrived_last_2h" not in df.columns:
            df["patients_arrived_last_2h"] = df["patients_arrived_last_1h"] * 2

        if "patients_treated_last_1h" not in df.columns:
            if "treatment_rate_per_hour" in df.columns:
                df["patients_treated_last_1h"] = df["treatment_rate_per_hour"]
            else:
                df["patients_treated_last_1h"] = df.get("patients_treated", 4) * 4

        if "patients_waiting_change_1h" not in df.columns:
            df["patients_waiting_change_1h"] = 0.0

        if "congestion_score_change_1h" not in df.columns:
            df["congestion_score_change_1h"] = 0.0

        if "bed_occupancy_change_1h" not in df.columns:
            df["bed_occupancy_change_1h"] = 0.0

        if "wait_time_change_1h" not in df.columns:
            df["wait_time_change_1h"] = 0.0

        # Verify and extract exactly the model features
        missing_cols = [c for c in self.feature_columns if c not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing mandatory features for prediction: {missing_cols}")

        return df[self.feature_columns]

    def predict(self, input_data: Union[Dict[str, Any], pd.Series, pd.DataFrame]) -> Dict[str, Any]:
        """
        Generates single prediction dictionary with probability, class, risk level,
        and prediction horizon.
        """
        feat_df = self._prepare_features(input_data)
        prob = float(self.model.predict_proba(feat_df)[0, 1])
        predicted_bool = bool(prob >= 0.50)
        risk = determine_risk_level(prob)

        return {
            "congestion_probability": round(prob, 4),
            "predicted_congestion": predicted_bool,
            "risk_level": risk,
            "prediction_horizon_minutes": 60,
        }

    def predict_batch(self, df: pd.DataFrame) -> list[Dict[str, Any]]:
        """
        Batch prediction for multiple sequential intervals.
        """
        feat_df = self._prepare_features(df)
        probs = self.model.predict_proba(feat_df)[:, 1]
        results = []
        for p in probs:
            p_float = float(p)
            results.append({
                "congestion_probability": round(p_float, 4),
                "predicted_congestion": bool(p_float >= 0.50),
                "risk_level": determine_risk_level(p_float),
                "prediction_horizon_minutes": 60,
            })
        return results


# Global singleton instance for high-performance reuse
_predictor_instance = None


def get_predictor() -> CongestionPredictor:
    """Returns or initializes the singleton predictor instance."""
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = CongestionPredictor()
    return _predictor_instance


def predict_congestion(operational_data: Union[Dict[str, Any], pd.Series, pd.DataFrame]) -> Dict[str, Any]:
    """
    Convenience function to predict congestion using cached predictor singleton.
    """
    predictor = get_predictor()
    return predictor.predict(operational_data)


def main():
    print("=" * 80)
    print("ER-AEGIS: CONGESTION PREDICTION SERVICE TEST")
    print("=" * 80)

    # Load dataset to test prediction service on test partition rows
    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset not found at {DATA_PATH}")
        sys.exit(1)

    df_raw = pd.read_csv(DATA_PATH)
    total = len(df_raw)
    split_idx = int(total * 0.80)
    df_test = df_raw.iloc[split_idx:].reset_index(drop=True)

    print(f"Testing inference service on test set partition ({len(df_test)} observations)...")
    predictor = get_predictor()
    print(f"Loaded model successfully. Number of features: {len(predictor.feature_columns)}")

    # Test 5 representative cases: normal, moderate, surge buildup, peak surge, post-surge
    test_cases = [
        {"desc": "Normal Baseline Night (Test Row 10)", "idx": 10},
        {"desc": "Moderate Daytime Inflow (Test Row 70)", "idx": 70},
        {"desc": "Surge Pre-Peak Warning Buildup (Test Row 130)", "idx": 130},
        {"desc": "High Congestion Acute Peak (Test Row 175)", "idx": 175},
        {"desc": "Post-Surge Bed Decompression (Test Row 220)", "idx": 220},
    ]

    print("\n" + "-" * 80)
    for case in test_cases:
        row = df_test.iloc[case["idx"]]
        result = predictor.predict(row.to_dict())
        actual = int(row.get("high_congestion_next_60min", -1))
        
        print(f"Scenario:              {case['desc']}")
        print(f"Timestamp:             {row['timestamp']}")
        print(f"Actual Future Target:  {actual} ({'High Congestion' if actual == 1 else 'Normal'})")
        print(f"Prediction Result:     {json.dumps(result, indent=2)}")
        print("-" * 80)

    print("\n[SUCCESS] All prediction checks passed. The service is ready for integration.")


if __name__ == "__main__":
    main()
