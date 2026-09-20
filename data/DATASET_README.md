# ER-AEGIS Synthetic Hospital Operations Dataset

## Overview & Purpose

The **ER-AEGIS Synthetic Hospital Operations Dataset** (`data/hospital_data.csv`) is a time-series operational dataset created for training, validating, and testing machine learning models that predict Emergency Department (ED) congestion and resource saturation.

The dataset models a simulated 70-bed Emergency Department over **14 consecutive days** at **15-minute intervals**, generating **1,344 sequential observations**.

> **IMPORTANT HACKATHON POSITIONING & DISCLAIMER:**
> This dataset is purely synthetic and created solely to demonstrate the technical concept of predictive emergency-department operations for the ER-AEGIS prototype.
> - **NO** real patient data or personally identifiable information (PII) was used.
> - **DO NOT** interpret this dataset or derived metrics as clinically validated or medically certified.
> - This data is strictly intended for administrative capacity planning, triage queue modeling, and technical ML pipeline demonstration.

---

## Dataset Dimensions & Specifications

- **File Path**: `data/hospital_data.csv`
- **Generator Script**: `data/generate_hospital_data.py`
- **Total Rows**: 1,344 observations (14 days × 24 hours × 4 intervals/hour)
- **Total Columns**: 21 operational features and target
- **Time Frequency**: Exactly 15 minutes per observation
- **Timeframe**: `2026-09-01 00:00` to `2026-09-14 23:45` (UTC/consistent local standard)
- **Random Seed**: `SEED = 42` (fully deterministic and reproducible)

---

## Complete Column Data Dictionary

| # | Column Name | Data Type | Range / Format | Operational Description |
|---|-------------|-----------|----------------|--------------------------|
| 1 | `timestamp` | String | `YYYY-MM-DD HH:MM` | Timestamp of observation at 15-minute cadence. |
| 2 | `patients_arrived` | Integer | 0 – 26 | Total newly registered patient arrivals during this 15-minute interval (walk-in + EMS). |
| 3 | `ambulance_arrivals` | Integer | 0 – 8 | Emergency Medical Service (EMS) ambulance arrivals (strictly $\le$ `patients_arrived`). |
| 4 | `patients_waiting` | Integer | 0 – 48 | Number of triaged patients in waiting room awaiting an open clinical bed or examination. |
| 5 | `patients_treated` | Integer | 0 – 14 | Patients completing clinical treatment or initiated into disposition during this interval. |
| 6 | `beds_total` | Integer | 70 | Total staffed licensed acute ED care beds (held constant at 70). |
| 7 | `beds_occupied` | Integer | 20 – 68 | Current acute care beds physically occupied by patients undergoing active treatment or boarding. |
| 8 | `beds_available` | Integer | 2 – 50 | ED beds ready for immediate patient placement (`beds_total - beds_occupied`). |
| 9 | `doctors_available` | Integer | 6 – 15 | Attending and resident emergency physicians on active clinical duty. |
| 10 | `nurses_available` | Integer | 15 – 30 | Emergency department Registered Nurses (RNs) on active duty. |
| 11 | `support_staff_available` | Integer | 5 – 12 | Techs, triage coordinators, and registration clerks on active duty. |
| 12 | `average_wait_time` | Float | 10.3 – 120.0 min | Rolling average duration from initial triage arrival to first physician contact (door-to-doc). |
| 13 | `average_treatment_time` | Float | 18.0 – 58.0 min | Clinical duration from first physician contact to disposition decision. |
| 14 | `admissions` | Integer | 0 – 6 | Patients requiring inpatient bed admission (strictly $\le$ `patients_treated`). |
| 15 | `discharges` | Integer | 0 – 8 | Patients discharged home or transferred out, freeing active ED beds. |
| 16 | `arrival_rate_per_hour` | Integer | 0 – 85 / hr | Derived rolling 1-hour total arrival volume (current interval + preceding 3 intervals). |
| 17 | `treatment_rate_per_hour` | Integer | 0 – 42 / hr | Derived rolling 1-hour total treatment throughput (current interval + preceding 3 intervals). |
| 18 | `bed_occupancy_rate` | Float | 0.2857 – 0.9714 | Ratio of occupied beds to total licensed beds (`beds_occupied / beds_total`). |
| 19 | `staff_capacity_score` | Float | 0.2500 – 0.9833 | Ratio of available staff to nominal maximum, penalized by active patient workload. |
| 20 | `congestion_score` | Float | 0.8 – 100.0 | Synthetic composite operational congestion index (0 to 100). |
| 21 | `high_congestion_next_60min` | Integer | 0 or 1 | **Machine Learning Binary Target**: 1 if `congestion_score >= 65.0` in any of the next 4 intervals ($t+1 \dots t+4$). |

---

## Synthetic Data Generation Methodology

The dataset was generated using physical queuing principles, discrete conservation laws, and circadian empirical modeling:

### 1. Diurnal Inflow & Day-of-Week Waves
- **Diurnal Rhythm**: Modeled via piecewise circadian sinusoidal profiles:
  - 00:00–05:00: Low baseline volume (~5–9 arrivals/hr)
  - 05:00–08:00: Early morning ramp (~9–18 arrivals/hr)
  - 08:00–12:00: Moderate morning ambulatory demand (~18–26 arrivals/hr)
  - 12:00–17:00: Peak afternoon demand (~26–33 arrivals/hr)
  - 17:00–22:00: Sustained evening surge (~32–38 arrivals/hr)
  - 22:00–00:00: Gradual late-night descent
- **Day-of-Week Variation**:
  - **Mondays** (Day 6 & Day 13): 1.16× volume multiplier (post-weekend clinic overflow and delayed presentation)
  - **Fridays** (Day 3 & Day 10): 1.10×–1.12× volume multiplier (weekend prelude)
  - **Saturdays/Sundays**: Elevated evening acute trauma/EMS proportions
  - **Midweek**: Baseline steady state (0.97×–1.02×)

### 2. Physical Conservation & Queue Dynamics
- **Queue Balance Law**:
  $$\text{patients\_waiting}(t) = \max\Big(0,\; \text{patients\_waiting}(t-1) + \text{patients\_arrived}(t) - \text{patients\_treated}(t)\Big)$$
  The waiting room never generates or loses patients at random.
- **Treatment Capacity**:
  $$\text{Capacity} = \Big(0.50 \cdot \text{docs} + 0.12 \cdot \text{nurses} + 0.08 \cdot \text{support}\Big) \times \left(\frac{\text{beds\_available}}{\text{beds\_total}}\right)^{0.16} \times \Big(1.0 - 0.20 \cdot \text{occupancy\_ratio}^2\Big)$$
  Treatment slows under acute bed exhaustion and congestion friction.
- **Bed Occupancy Homeostasis**:
  $$\text{beds\_occupied}(t) = \text{clip}\Big(\text{beds\_occupied}(t-1) + \text{admissions}(t) - \text{discharges}(t),\; 20,\; 70\Big)$$
  $$\text{beds\_available}(t) = \text{beds\_total} - \text{beds\_occupied}(t)$$

### 3. Staffing Shifts & Capacity Score
- **Day Shift (07:00–15:00)**: 13–15 physicians, 25–29 nurses, 9–12 support staff
- **Evening Shift (15:00–23:00)**: 11–13 physicians, 21–25 nurses, 7–10 support staff
- **Night Shift (23:00–07:00)**: 7–9 physicians, 15–18 nurses, 5–7 support staff
- **Staff Capacity Formula**:
  $$\text{base} = 0.35 \cdot \frac{\text{docs}}{15} + 0.45 \cdot \frac{\text{nurses}}{30} + 0.20 \cdot \frac{\text{support}}{12}$$
  $$\text{workload\_penalty} = \max\Big(0.0,\; (\text{beds\_occupied} + \text{patients\_waiting} - 50) \cdot 0.005\Big)$$
  $$\text{staff\_capacity\_score} = \text{clip}(\text{base} - \text{workload\_penalty},\; 0.25,\; 1.0)$$

---

## Congestion Score Formula

The `congestion_score` is a continuous index bounded between **0.0 and 100.0** representing holistic operational strain across six sub-dimensions:

1. **Bed Occupancy Pressure ($C_{\text{bed}}$)**:
   $$C_{\text{bed}} = \text{clip}\left(\frac{\text{bed\_occupancy\_rate} - 0.48}{0.44},\; 0,\; 1\right) \times 100$$
2. **Queue Pressure ($C_{\text{queue}}$)**:
   $$C_{\text{queue}} = \text{clip}\left(\frac{\text{patients\_waiting} - 3.0}{25.0},\; 0,\; 1\right) \times 100$$
3. **Door-to-Doctor Wait Pressure ($C_{\text{wait}}$)**:
   $$C_{\text{wait}} = \text{clip}\left(\frac{\text{average\_wait\_time} - 16.0}{46.0},\; 0,\; 1\right) \times 100$$
4. **Flow Imbalance Pressure ($C_{\text{flow}}$)**:
   $$C_{\text{flow}} = \text{clip}\left(\frac{\text{arrival\_rate\_per\_hour} - \text{treatment\_rate\_per\_hour} + 2.0}{18.0},\; 0,\; 1\right) \times 100$$
5. **Staffing Strain ($C_{\text{staff}}$)**:
   $$C_{\text{staff}} = \text{clip}\left(\frac{0.92 - \text{staff\_capacity\_score}}{0.55},\; 0,\; 1\right) \times 100$$
6. **Arrival Momentum ($C_{\text{momentum}}$)**:
   $$C_{\text{momentum}} = \text{clip}\left(\frac{\text{arrival\_rate\_per\_hour} - 18.0}{22.0},\; 0,\; 1\right) \times 100$$

### Weighted Composite Formula:
$$\text{congestion\_score} = 0.26\, C_{\text{bed}} + 0.24\, C_{\text{queue}} + 0.22\, C_{\text{wait}} + 0.14\, C_{\text{flow}} + 0.08\, C_{\text{staff}} + 0.06\, C_{\text{momentum}}$$

*(Rounded to 1 decimal place; strictly clipped between 0.0 and 100.0)*

---

## Machine Learning Target: `high_congestion_next_60min`

- **Definition**: Binary indicator (`0` or `1`).
- **Operational Meaning**:
  - `0`: The Emergency Department is **not** expected to enter a high-congestion state within the next 60 minutes.
  - `1`: The Emergency Department is **expected** to enter a high-congestion state ($\ge 65.0$ congestion score) within the next 60 minutes.
- **Mathematical Lookahead Calculation**:
  For observation row $i$ at timestamp $t$:
  $$\text{high\_congestion\_next\_60min}_i = \begin{cases} 1 & \text{if } \exists k \in \{1, 2, 3, 4\} \text{ s.t. } \text{congestion\_score}_{i+k} \ge 65.0 \\ 0 & \text{otherwise} \end{cases}$$
- **Data Leakage Safeguard**:
  The target is generated **strictly from future intervals** ($t+15\text{m}, t+30\text{m}, t+45\text{m}, t+60\text{m}$). Future information is **never** embedded in the input feature columns of row $i$.

### Class Balance:
- **Normal Class (`0`)**: 1,071 rows (**79.7%**)
- **High Congestion Warning (`1`)**: 273 rows (**20.3%**)
- Meets the optimal 15%–30% prevalence target for supervised classification and early warning modeling.

---

## Modeled Surge Events & Recovery Dynamics

Four major clinical surge scenarios are explicitly modeled to provide realistic deterioration and recovery signatures:

### 1. Surge 1: Interstate Pileup & Severe Thunderstorm
- **Timing**: Day 3 (Fri Sept 4), 18:30 – 21:15 (11 intervals / 2.75 hours)
- **Signature**: Sudden ambulance burst (up to 4–5 EMS transports per 15 min), high-acuity trauma presentations, acute wait room spike.
- **Recovery**: Rapid trauma triage disposition, ambulance diversion clearance, returning to baseline within 2 hours.

### 2. Surge 2: Monday Bed-Block & Respiratory Outbreak (Early-Warning Ramp)
- **Timing**: Day 6 (Mon Sept 7), 12:30 – 16:30 (16 intervals / 4.0 hours)
- **Signature**: High post-weekend admission demand colliding with hospital-wide inpatient bed gridlock. Discharges plummet from 2.0 to 0.4 per interval. Bed occupancy reaches 68/70 (97%).
- **Early-Warning Characteristic**: Waiting room queue and wait times begin climbing at **11:30 (4 intervals / 60 minutes BEFORE peak congestion hits $\ge 65.0$)**, allowing ML algorithms to detect early warning precursors.
- **Recovery**: Inpatient hospital administration activates surge discharge protocols, clearing 3–5 beds per interval until occupancy drops back to ~40.

### 3. Surge 3: Industrial Hazmat Incident & Nursing Staff Shortage
- **Timing**: Day 10 (Fri Sept 11), 20:00 – 23:00 (12 intervals / 3.0 hours)
- **Signature**: Decontamination triage wave combined with unscheduled nursing call-outs (nurses drop to 15–16), severely reducing treatment capacity while arrivals surge 2.0×.
- **Recovery**: On-call staff mobilized; decontamination clear.

### 4. Surge 4: Heatwave Mass Gathering / Outdoor Festival Collapse
- **Timing**: Day 12 (Sun Sept 13), 14:00 – 16:30 (10 intervals / 2.5 hours)
- **Signature**: Dehydration, heat exhaustion, and acute intoxication admissions causing rapid ED bed saturation.
- **Recovery**: Rehydration bay processing and accelerated same-day discharges.

---

## Automated Data Quality Verification Suite

The dataset was validated against 17 automated quality tests with a **100% pass rate**:

1. **Row Count**: Exactly 1,344 rows (`PASS`)
2. **Unique Timestamps**: 0 duplicate timestamps (`PASS`)
3. **Time Continuity**: Unbroken 15-minute sequence (`PASS`)
4. **Bed Conservation**: `beds_available == beds_total - beds_occupied` with 0 deviations (`PASS`)
5. **Bed Occupancy Range**: Strictly bounded between 20 and 68 beds (`PASS`)
6. **Congestion Score Bounds**: Strictly within 0.8 to 100.0 (`PASS`)
7. **Staff Capacity Score**: Strictly within 0.25 to 0.9833 (`PASS`)
8. **Binary Target**: `high_congestion_next_60min` contains only `{0, 1}` (`PASS`)
9. **Ambulance Constraint**: `ambulance_arrivals <= patients_arrived` with 0 violations (`PASS`)
10. **Admission Constraint**: `admissions <= patients_treated` with 0 violations (`PASS`)
11. **Non-Negativity (Patients)**: Zero negative patient counts (`PASS`)
12. **Non-Negativity (Beds)**: Zero negative bed counts (`PASS`)
13. **Plausible Wait Times**: 10.3 to 120.0 minutes (`PASS`)
14. **Plausible Throughput**: Max arrival rate 85/hr, Max treatment rate 42/hr (`PASS`)
15. **Surge Presence**: 65 intervals with acute peak congestion $\ge 80.0$ (`PASS`)
16. **Dynamic Range Representation**: 927 low-congestion intervals (<40) and 228 high-congestion intervals ($\ge 65.0$) (`PASS`)
17. **Target Class Balance**: 273 positive labels (**20.3%**), satisfying the 15%–30% requirement (`PASS`)

---

## How to Regenerate the Dataset

To regenerate the dataset from scratch:

```bash
# Ensure Python 3 with pandas and numpy is available
python3 data/generate_hospital_data.py
```

The script will automatically re-simulate all 1,344 intervals with the fixed random seed (`42`), execute the 17-point quality test suite, display the summary statistics and sample rows, and overwrite `data/hospital_data.csv`.
