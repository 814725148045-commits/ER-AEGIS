"""
Prediction Service for ER-AEGIS FastAPI Backend
Loads trained Random Forest model once and executes low-latency inference.
"""

import os
import sys
import json
from typing import Dict, Any, Union
import pandas as pd
import joblib

# Resolve project paths
SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SERVICE_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
ML_DIR = os.path.join(PROJECT_ROOT, "ml")

MODEL_PATH = os.path.join(ML_DIR, "model.joblib")
FEATURES_PATH = os.path.join(ML_DIR, "feature_columns.json")


def determine_risk_level(prob: float) -> str:
    """
    Threshold definition:
    0.00–0.39 = LOW
    0.40–0.64 = MODERATE
    0.65–0.84 = HIGH
    0.85–1.00 = CRITICAL
    """
    if prob < 0.40:
        return "LOW"
    elif prob < 0.65:
        return "MODERATE"
    elif prob < 0.85:
        return "HIGH"
    else:
        return "CRITICAL"


class PredictionService:
    def __init__(self, model_path: str = MODEL_PATH, features_path: str = FEATURES_PATH):
        self.model_path = model_path
        self.features_path = features_path
        self.model = None
        self.feature_columns = []
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file missing at: {self.model_path}. Run ml/train_model.py first.")
        if not os.path.exists(self.features_path):
            raise FileNotFoundError(f"Features file missing at: {self.features_path}. Run ml/train_model.py first.")

        self.model = joblib.load(self.model_path)
        with open(self.features_path, "r") as f:
            self.feature_columns = json.load(f)["feature_columns"]
        print(f"[ER-AEGIS Backend] Model loaded successfully. Ready with {len(self.feature_columns)} features.")

    def is_loaded(self) -> bool:
        return self.model is not None and len(self.feature_columns) > 0

    def prepare_feature_row(self, data: Union[Dict[str, Any], pd.Series, pd.DataFrame]) -> pd.DataFrame:
        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, pd.Series):
            df = pd.DataFrame([data.to_dict()])
        elif isinstance(data, pd.DataFrame):
            df = data.copy()
        else:
            raise ValueError("Input data must be a dictionary, pandas Series, or DataFrame.")

        # Temporal features
        if "timestamp" in df.columns:
            dt = pd.to_datetime(df["timestamp"])
            if "hour" not in df.columns:
                df["hour"] = dt.dt.hour
            if "day_of_week" not in df.columns:
                df["day_of_week"] = dt.dt.dayofweek
            if "is_weekend" not in df.columns:
                df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
        else:
            if "hour" not in df.columns:
                df["hour"] = 14  # Typical afternoon default
            if "day_of_week" not in df.columns:
                df["day_of_week"] = 2  # Wednesday default
            if "is_weekend" not in df.columns:
                df["is_weekend"] = 0

        # Fallback estimations for recent-trend features if missing from single-row input
        if "patients_arrived_last_1h" not in df.columns:
            if "arrival_rate_per_hour" in df.columns:
                df["patients_arrived_last_1h"] = df["arrival_rate_per_hour"].astype(float)
            elif "patients_arrived" in df.columns:
                df["patients_arrived_last_1h"] = (df["patients_arrived"] * 4).astype(float)
            else:
                df["patients_arrived_last_1h"] = 16.0

        if "patients_arrived_last_2h" not in df.columns:
            df["patients_arrived_last_2h"] = df["patients_arrived_last_1h"] * 2.0

        if "patients_treated_last_1h" not in df.columns:
            if "treatment_rate_per_hour" in df.columns:
                df["patients_treated_last_1h"] = df["treatment_rate_per_hour"].astype(float)
            elif "patients_treated" in df.columns:
                df["patients_treated_last_1h"] = (df["patients_treated"] * 4).astype(float)
            else:
                df["patients_treated_last_1h"] = 16.0

        if "patients_waiting_change_1h" not in df.columns:
            df["patients_waiting_change_1h"] = 0.0

        if "congestion_score_change_1h" not in df.columns:
            df["congestion_score_change_1h"] = 0.0

        if "bed_occupancy_change_1h" not in df.columns:
            df["bed_occupancy_change_1h"] = 0.0

        if "wait_time_change_1h" not in df.columns:
            df["wait_time_change_1h"] = 0.0

        # Ensure all columns present
        for col in self.feature_columns:
            if col not in df.columns:
                df[col] = 0.0

        return df[self.feature_columns]

    def predict(self, input_data: Union[Dict[str, Any], pd.Series, pd.DataFrame]) -> Dict[str, Any]:
        feat_df = self.prepare_feature_row(input_data)
        prob = float(self.model.predict_proba(feat_df)[0, 1])
        predicted_bool = bool(prob >= 0.50)
        risk = determine_risk_level(prob)

        # Extract timestamp if available
        timestamp_str = ""
        if isinstance(input_data, dict):
            timestamp_str = str(input_data.get("timestamp", ""))
        elif isinstance(input_data, pd.Series):
            timestamp_str = str(input_data.get("timestamp", ""))
        elif isinstance(input_data, pd.DataFrame) and "timestamp" in input_data.columns:
            timestamp_str = str(input_data["timestamp"].iloc[0])

        return {
            "congestion_probability": round(prob, 4),
            "predicted_congestion": predicted_bool,
            "predicted_congestion_level": risk,
            "risk_level": risk,
            "horizon_minutes": 60,
            "prediction_horizon_minutes": 60,
            "model_name": "RandomForestClassifier (28 features, 60-min horizon)",
            "generated_at": timestamp_str or None,
        }


# Global singleton instance
_prediction_service_instance = None


def get_prediction_service() -> PredictionService:
    global _prediction_service_instance
    if _prediction_service_instance is None:
        _prediction_service_instance = PredictionService()
    return _prediction_service_instance
