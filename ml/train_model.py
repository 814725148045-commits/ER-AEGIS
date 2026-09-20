#!/usr/bin/env python3
"""
================================================================================
ER-AEGIS: AI Emergency Response & Resource Intelligence System
Machine Learning Training Pipeline (v1.0)
================================================================================

Description:
    Trains the first baseline machine learning model for ER-AEGIS to predict
    whether the Emergency Department will enter a high-congestion state
    within the next 60 minutes (high_congestion_next_60min).

Architecture:
    - Algorithm: RandomForestClassifier (class_weight='balanced', random_state=42)
    - Chronological Train/Test Split (80% Train, 20% Test)
    - Zero Target / Future Leakage
    - Realistic Operational Feature Engineering & Recent-Trend Dynamics
    - Explainability: Top 10 Feature Importances
    - Artifacts saved: model.joblib, feature_columns.json, evaluation.json

Usage:
    python3 ml/train_model.py
================================================================================
"""

import os
import sys
import json
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
)
import joblib

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, "data", "hospital_data.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model.joblib")
FEATURES_PATH = os.path.join(BASE_DIR, "feature_columns.json")
EVALUATION_PATH = os.path.join(BASE_DIR, "evaluation.json")

RANDOM_STATE = 42
TRAIN_RATIO = 0.80
N_ESTIMATORS = 300


def get_risk_level(prob: float) -> str:
    """
    Converts congestion probability into prototype operational risk level.
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


def engineer_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Constructs contemporaneous, temporal, and historical rolling trend features.
    STRICT SAFEGUARD: No future information is utilized.
    All rolling/trend features use strictly past and current observations.
    """
    df = df.copy()
    
    # 1. Parse timestamp and create temporal calendar features
    dt_series = pd.to_datetime(df["timestamp"])
    df["hour"] = dt_series.dt.hour
    df["day_of_week"] = dt_series.dt.dayofweek  # 0=Monday, 6=Sunday
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # 2. Historical rolling trend features (4 intervals = 1 hour, 8 intervals = 2 hours)
    # Closed rolling window over past intervals ensures no future leakage
    df["patients_arrived_last_1h"] = (
        df["patients_arrived"].rolling(window=4, min_periods=1).sum()
    )
    df["patients_arrived_last_2h"] = (
        df["patients_arrived"].rolling(window=8, min_periods=1).sum()
    )
    df["patients_treated_last_1h"] = (
        df["patients_treated"].rolling(window=4, min_periods=1).sum()
    )

    # Momentum / Rate-of-change features (current value - value 4 intervals ago)
    # Uses diff(4) with fillna(0) to strictly use past data
    df["patients_waiting_change_1h"] = df["patients_waiting"].diff(4).fillna(0)
    df["congestion_score_change_1h"] = df["congestion_score"].diff(4).fillna(0)
    df["bed_occupancy_change_1h"] = df["beds_occupied"].diff(4).fillna(0)
    df["wait_time_change_1h"] = df["average_wait_time"].diff(4).fillna(0)

    # Defined list of input features (EXCLUDING timestamp and target column)
    feature_cols = [
        # Instantaneous operational measurements
        "patients_arrived",
        "ambulance_arrivals",
        "patients_waiting",
        "patients_treated",
        "beds_occupied",
        "beds_available",
        "doctors_available",
        "nurses_available",
        "support_staff_available",
        "average_wait_time",
        "average_treatment_time",
        "admissions",
        "discharges",
        "arrival_rate_per_hour",
        "treatment_rate_per_hour",
        "bed_occupancy_rate",
        "staff_capacity_score",
        "congestion_score",
        # Temporal features
        "hour",
        "day_of_week",
        "is_weekend",
        # Recent-trend / momentum features (past 1h / 2h)
        "patients_arrived_last_1h",
        "patients_arrived_last_2h",
        "patients_treated_last_1h",
        "patients_waiting_change_1h",
        "congestion_score_change_1h",
        "bed_occupancy_change_1h",
        "wait_time_change_1h",
    ]

    return df, feature_cols


def main():
    print("=" * 80)
    print("ER-AEGIS: EMERGENCY DEPARTMENT CONGESTION PREDICTION MODEL TRAINING")
    print("=" * 80)

    # 1. Load data
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    print(f"Loading operational dataset from: {DATA_PATH}")
    df_raw = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df_raw)} rows and {len(df_raw.columns)} columns.")

    # Sort chronologically by timestamp
    df_raw["timestamp_dt"] = pd.to_datetime(df_raw["timestamp"])
    df_raw = df_raw.sort_values("timestamp_dt").reset_index(drop=True)
    df_raw = df_raw.drop(columns=["timestamp_dt"])

    # 2. Feature Engineering
    print("\nEngineering operational, temporal, and historical trend features...")
    df_feat, feature_cols = engineer_features(df_raw)
    print(f"Constructed {len(feature_cols)} total predictive features.")

    # Confirm zero target leakage in feature_cols
    assert "high_congestion_next_60min" not in feature_cols, "CRITICAL ERROR: Target leakage detected!"
    for col in feature_cols:
        assert not col.startswith("future_"), f"Potential future feature detected: {col}"

    target_col = "high_congestion_next_60min"
    X = df_feat[feature_cols]
    y = df_feat[target_col]

    # 3. Chronological Train / Test Split (First 80% Train, Final 20% Test)
    total_obs = len(df_feat)
    split_idx = int(total_obs * TRAIN_RATIO)

    X_train = X.iloc[:split_idx]
    y_train = y.iloc[:split_idx]
    X_test = X.iloc[split_idx:]
    y_test = y.iloc[split_idx:]
    test_timestamps = df_feat["timestamp"].iloc[split_idx:].values

    print("\nChronological Split Details:")
    print(f"  Training set:  {len(X_train)} observations (80.0%) [{df_feat['timestamp'].iloc[0]} to {df_feat['timestamp'].iloc[split_idx-1]}]")
    print(f"  Testing set:   {len(X_test)} observations (20.0%) [{df_feat['timestamp'].iloc[split_idx]} to {df_feat['timestamp'].iloc[-1]}]")
    print(f"  Train Target Balance: Class 0 = {(y_train == 0).sum()} ({(y_train == 0).mean():.1%}), Class 1 = {(y_train == 1).sum()} ({(y_train == 1).mean():.1%})")
    print(f"  Test Target Balance:  Class 0 = {(y_test == 0).sum()} ({(y_test == 0).mean():.1%}), Class 1 = {(y_test == 1).sum()} ({(y_test == 1).mean():.1%})")

    # 4. Model Training
    print(f"\nTraining RandomForestClassifier (n_estimators={N_ESTIMATORS}, class_weight='balanced', random_state={RANDOM_STATE})...")
    model = RandomForestClassifier(
        n_estimators=N_ESTIMATORS,
        class_weight="balanced",
        max_depth=14,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    print("Model training completed successfully.")

    # 5. Model Evaluation on Chronological Test Set
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, y_proba))
    cm = confusion_matrix(y_test, y_pred).tolist()

    # High-congestion recall is specifically the recall for class 1
    high_congestion_recall = rec

    print("\n" + "=" * 80)
    print("TEST SET EVALUATION METRICS (Chronological Final 20%)")
    print("=" * 80)
    print(f"Accuracy:                 {acc:.4f} ({acc*100:.2f}%)")
    print(f"Precision:                {prec:.4f} ({prec*100:.2f}%)")
    print(f"Recall:                   {rec:.4f} ({rec*100:.2f}%)")
    print(f"F1 Score:                 {f1:.4f}")
    print(f"ROC-AUC:                  {roc_auc:.4f}")
    print(f"High-Congestion Recall:   {high_congestion_recall:.4f} ({high_congestion_recall*100:.2f}%)")
    print("\nConfusion Matrix:")
    print(f"  [TN={cm[0][0]:3d},  FP={cm[0][1]:3d}]")
    print(f"  [FN={cm[1][0]:3d},  TP={cm[1][1]:3d}]")
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, target_names=["Normal (0)", "High Congestion (1)"]))

    # 6. Feature Importance
    importances = model.feature_importances_
    feat_imp = sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True)
    top_10 = [{"feature": f, "importance": round(float(imp), 4)} for f, imp in feat_imp[:10]]

    print("Top 10 Most Influential Features:")
    print("-" * 50)
    for rank, item in enumerate(top_10, 1):
        print(f"  {rank:2d}. {item['feature']:28s} {item['importance']:.4f}")

    # 7. Save Artifacts
    print("\nSaving model artifacts...")
    joblib.dump(model, MODEL_PATH)
    print(f"  Model saved to:               {MODEL_PATH}")

    with open(FEATURES_PATH, "w") as f:
        json.dump({"feature_columns": feature_cols}, f, indent=2)
    print(f"  Feature columns saved to:     {FEATURES_PATH}")

    eval_data = {
        "dataset_rows": total_obs,
        "training_rows": len(X_train),
        "testing_rows": len(X_test),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "high_congestion_recall": round(high_congestion_recall, 4),
        "confusion_matrix": {
            "true_negatives": cm[0][0],
            "false_positives": cm[0][1],
            "false_negatives": cm[1][0],
            "true_positives": cm[1][1],
            "matrix_list": cm,
        },
        "top_feature_importance": top_10,
        "all_feature_importance": [{"feature": f, "importance": round(float(imp), 4)} for f, imp in feat_imp],
        "model_parameters": {
            "model_type": "RandomForestClassifier",
            "n_estimators": N_ESTIMATORS,
            "class_weight": "balanced",
            "max_depth": 14,
            "min_samples_split": 4,
            "min_samples_leaf": 2,
            "random_state": RANDOM_STATE,
        },
        "risk_thresholds": {
            "LOW": "0.00 - 0.39",
            "MODERATE": "0.40 - 0.64",
            "HIGH": "0.65 - 0.84",
            "CRITICAL": "0.85 - 1.00",
        },
        "disclaimer": (
            "This model is a hackathon prototype trained on synthetic operational data. "
            "It is NOT clinically validated, should NOT be used for clinical decision-making, "
            "does NOT diagnose patients, and does NOT recommend treatment."
        ),
        "training_timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
    }

    with open(EVALUATION_PATH, "w") as f:
        json.dump(eval_data, f, indent=2)
    print(f"  Evaluation saved to:          {EVALUATION_PATH}")

    # 8. Sample Test Predictions
    print("\n" + "=" * 80)
    print("FIVE EXAMPLE TEST PREDICTIONS")
    print("=" * 80)
    
    # Select 5 representative rows across test set (normal, transition, surge peak)
    sample_indices = [15, 65, 110, 160, 210]
    for sample_idx in sample_indices:
        row_feat = X_test.iloc[[sample_idx]]
        actual_label = int(y_test.iloc[sample_idx])
        ts = test_timestamps[sample_idx]
        
        prob = float(model.predict_proba(row_feat)[0, 1])
        pred_class = int(prob >= 0.5)
        risk = get_risk_level(prob)

        print(f"Timestamp:              {ts}")
        print(f"  Actual Target:        {actual_label} ({'High Congestion' if actual_label else 'Normal'})")
        print(f"  Predicted Prob:       {prob:.4f}")
        print(f"  Predicted Class:      {pred_class} ({'High Congestion' if pred_class else 'Normal'})")
        print(f"  Risk Level:           {risk}")
        print(f"  Prediction Horizon:   60 minutes")
        print("-" * 50)


if __name__ == "__main__":
    main()
