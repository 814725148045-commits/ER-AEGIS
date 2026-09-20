# ER-AEGIS: Emergency Department Congestion Prediction ML Model

## Overview

The **ER-AEGIS Congestion Prediction Model** is a production-style machine learning pipeline designed to predict whether an Emergency Department (ED) will transition into a high-congestion state within the next 60 minutes.

- **Problem Type**: Supervised Binary Classification
- **Target Column**: `high_congestion_next_60min`
- **Prediction Horizon**: 60 minutes forward-looking
- **Primary Algorithm**: Random Forest Classifier (`RandomForestClassifier`)
- **Pipeline Implementation**: Python 3, scikit-learn, pandas, numpy, joblib

> **HACKATHON PROTOTYPE DISCLAIMER:**
> This model is an operational prototype trained on synthetic operational hospital time-series data (`data/hospital_data.csv`).
> - It is **NOT** clinically validated or certified by medical regulatory bodies.
> - It must **NOT** be used for clinical diagnostic or patient triage decision-making.
> - It does **NOT** diagnose patients and does **NOT** recommend clinical treatment.
> - Its sole intended purpose is to demonstrate administrative capacity forecasting and proactive bed/staff resource coordination.

---

## Target Variable Definition

The machine learning target is:
$$\text{high\_congestion\_next\_60min} \in \{0, 1\}$$

- **`0` (Normal Operational State)**: The Emergency Department is **not** expected to enter high operational congestion ($\ge 65.0$ composite score) during the next 60 minutes.
- **`1` (High Congestion Warning)**: The Emergency Department is **expected** to encounter acute operational congestion within the next 60 minutes.

### Data Leakage Safeguards
- **Zero Target Leakage**: The target column is excluded from the input feature set ($X$).
- **Strictly Historical Features**: All rolling sums and momentum differentials use only past and current intervals ($t, t-15\text{m}, t-30\text{m}, t-60\text{m}$). No lead/future shifts are used.

---

## Predictive Features & Feature Engineering

The model utilizes **28 engineered operational features** available contemporaneously at prediction time:

### 1. Instantaneous Clinical & Operational State (18 features)
| Feature Name | Description |
|--------------|-------------|
| `patients_arrived` | Registrations during current 15-min interval |
| `ambulance_arrivals` | EMS arrivals during current 15-min interval |
| `patients_waiting` | Current active waiting room queue |
| `patients_treated` | Patients completing treatment or dispositioned |
| `beds_occupied` | Acute care beds currently occupied |
| `beds_available` | Immediate available beds (`70 - beds_occupied`) |
| `doctors_available` | Active attending & resident physicians |
| `nurses_available` | Active emergency registered nurses (RNs) |
| `support_staff_available`| Triage coordinators & technicians on duty |
| `average_wait_time` | Door-to-doctor average wait duration (minutes) |
| `average_treatment_time`| Physician contact to disposition duration (minutes) |
| `admissions` | Inpatient hospital admissions in current interval |
| `discharges` | Discharges freeing acute ED beds |
| `arrival_rate_per_hour` | Rolling 1-hour total arrival volume |
| `treatment_rate_per_hour`| Rolling 1-hour total treatment throughput |
| `bed_occupancy_rate` | Ratio of beds occupied to total capacity (70) |
| `staff_capacity_score` | Ratio of available staffing to workload demands |
| `congestion_score` | Instantaneous composite congestion index (0–100) |

### 2. Temporal Calendar Features (3 features)
- `hour`: Hour of day (0–23) capturing diurnal arrival fluctuations.
- `day_of_week`: Day of week (0=Monday through 6=Sunday) capturing weekend vs weekday patterns.
- `is_weekend`: Binary flag for Saturday or Sunday acute trauma/nightlife influx.

### 3. Recent Trend & Momentum Features (7 features)
- `patients_arrived_last_1h`: Rolling sum of patient arrivals over the past 4 intervals (1 hour).
- `patients_arrived_last_2h`: Rolling sum of patient arrivals over the past 8 intervals (2 hours).
- `patients_treated_last_1h`: Rolling sum of treated patients over the past 4 intervals (1 hour).
- `patients_waiting_change_1h`: Net change in waiting room queue over the past 1 hour ($Q_t - Q_{t-4}$).
- `congestion_score_change_1h`: Rate of change of the composite congestion score over past 1 hour.
- `bed_occupancy_change_1h`: Net change in occupied beds over past 1 hour ($B_t - B_{t-4}$).
- `wait_time_change_1h`: Change in rolling average wait time over the past 1 hour.

---

## Train / Test Strategy (Chronological Split)

Because Emergency Department operations exhibit strong temporal autocorrelation and shift dynamics, a standard randomized train/test split would cause lookahead data contamination.

We employ a **strict chronological split**:
- **Training Set (First 80%)**: Observations 1 to 1,075 (`2026-09-01 00:00` to `2026-09-12 04:30`)
  - Class 0: 886 (82.4%)
  - Class 1: 189 (17.6%)
- **Test Set (Final 20%)**: Observations 1,076 to 1,344 (`2026-09-12 04:45` to `2026-09-14 23:45`)
  - Class 0: 185 (68.8%)
  - Class 1: 84 (31.2%)

This simulates real-world deployment where ER-AEGIS is trained on past hospital history and evaluated exclusively on future unseen operational cycles.

---

## Model Architecture & Hyperparameters

- **Model Type**: Scikit-Learn `RandomForestClassifier`
- **`n_estimators`**: 300 decision trees
- **`class_weight`**: `"balanced"` (adjusts weights inversely proportional to class frequencies to prevent bias against rare surge events)
- **`max_depth`**: 14 (prevents overfitting to idiosyncratic noise)
- **`min_samples_split`**: 4
- **`min_samples_leaf`**: 2
- **`random_state`**: 42 (ensures deterministic reproducibility)

---

## Evaluation Metrics (Chronological Test Set)

Evaluated on the unseen final 20% test partition (269 sequential intervals):

| Metric | Score | Operational Significance |
|--------|-------|--------------------------|
| **Accuracy** | **92.94%** (0.9294) | Overall proportion of correct operational state classifications |
| **Precision** | **86.52%** (0.8652) | Probability that an alert corresponds to true upcoming congestion (low false alert fatigue) |
| **Recall (Sensitivity)** | **91.67%** (0.9167) | Proportion of actual high-congestion surges captured before occurrence |
| **High-Congestion Recall** | **91.67%** (0.9167) | Primary metric: captures 77 out of 84 imminent high-congestion intervals |
| **F1 Score** | **0.8902** | Harmonic balance between precision and recall |
| **ROC-AUC** | **0.9816** | Robust probability calibration across variable decision thresholds |

### Confusion Matrix (Test Set: 269 observations)
```
                  Predicted Normal (0)   Predicted High Congestion (1)
Actual Normal (0)              173 (TN)                        12 (FP)
Actual Congested (1)             7 (FN)                        77 (TP)
```

---

## Top 10 Feature Importances

Calculated from Gini impurity reductions across the 300 decision trees:

1. **`patients_waiting`** (23.30%): Current waiting room queue length is the strongest predictor of near-future room saturation.
2. **`congestion_score`** (18.84%): Current multi-factor operational stress index.
3. **`average_wait_time`** (16.30%): Door-to-doctor backlog velocity.
4. **`staff_capacity_score`** (5.64%): Staff exhaustion and workload strain index.
5. **`wait_time_change_1h`** (5.25%): 1-hour rate of wait time escalation.
6. **`bed_occupancy_rate`** (4.08%): Percentage of acute physical beds committed.
7. **`patients_arrived_last_2h`** (3.74%): Sustained ambulatory arrival wave volume.
8. **`beds_occupied`** (3.22%): Raw bed count occupancy.
9. **`average_treatment_time`** (2.88%): Length of clinical stay delays.
10. **`beds_available`** (2.56%): Remaining buffer before gridlock.

---

## Prediction Service & Output Schema

The prediction service (`ml/predict.py`) accepts latest operational data and returns a structured dictionary:

```json
{
  "congestion_probability": 0.9540,
  "predicted_congestion": true,
  "risk_level": "CRITICAL",
  "prediction_horizon_minutes": 60
}
```

### Risk Level Thresholds
- **`0.00 – 0.39`**: **LOW** (Normal workflow; standard staffing)
- **`0.40 – 0.64`**: **MODERATE** (Heightened awareness; monitor queue velocity)
- **`0.65 – 0.84`**: **HIGH** (Prepare surge protocol, alert on-call charge nurse)
- **`0.85 – 1.00`**: **CRITICAL** (Immediate escalation: expedite discharges, open overflow bays)

---

## How to Retrain and Test

### 1. Retrain the Model
```bash
python3 ml/train_model.py
```
This regenerates `ml/model.joblib`, updates `ml/feature_columns.json`, and records all performance metrics into `ml/evaluation.json`.

### 2. Test the Inference Service
```bash
python3 ml/predict.py
```
Executes the prediction pipeline across sample test-set observations and confirms probability output formatting.
