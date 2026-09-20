#!/usr/bin/env python3
"""
================================================================================
ER-AEGIS: AI Emergency Response & Resource Intelligence System
Synthetic Hospital Operations Dataset Generator (v1.0)
================================================================================

Description:
    Generates a realistic 14-day, 15-minute interval (1,344 rows) synthetic
    operational dataset for Emergency Department (ED) congestion prediction.

Key Characteristics:
    - Observations: 14 days x 24 hours x 4 intervals/hr = 1,344 sequential rows
    - Interval: Exactly 15 minutes (2026-09-01 00:00 to 2026-09-14 23:45)
    - ED Capacity: Exactly 70 beds
    - Diurnal rhythm, day-of-week modulation, realistic shift staffing
    - At least 3 operational surge events with pre-peak early-warning build-up
    - Explicit post-surge recovery cycles
    - Strict conservation laws:
        * beds_available = beds_total - beds_occupied
        * patients_waiting(t) = max(0, patients_waiting(t-1) + arrived - treated)
        * ambulance_arrivals <= patients_arrived
        * admissions <= patients_treated
    - Machine Learning Target: high_congestion_next_60min (forward-looking 60m horizon)
    - Target balance: ~15-30% positive class, ~70-85% negative class
    - Zero Personally Identifiable Information (PII)

Usage:
    python3 data/generate_hospital_data.py
================================================================================
"""

import os
import sys
import math
import random
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

# ------------------------------------------------------------------------------
# Configuration & Constants
# ------------------------------------------------------------------------------
RANDOM_SEED = 42
NUM_DAYS = 14
INTERVAL_MINUTES = 15
INTERVALS_PER_HOUR = 4
INTERVALS_PER_DAY = 24 * INTERVALS_PER_HOUR  # 96
TOTAL_ROWS = NUM_DAYS * INTERVALS_PER_DAY    # 1,344

BEDS_TOTAL = 70
START_TIMESTAMP = datetime(2026, 9, 1, 0, 0)

# Target threshold for High Congestion State (synthetic prototype metric)
# Represents high operational stress (wait time > 40m, bed occupancy > 75%, queue > 18)
HIGH_CONGESTION_THRESHOLD = 65.0

# ------------------------------------------------------------------------------
# Seed Initialization
# ------------------------------------------------------------------------------
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)


def get_diurnal_base_arrival_rate(hour: int, minute: int) -> float:
    """
    Returns baseline expected arrivals per 15-minute interval based on time of day.
    00:00–05:00: Low arrivals (1.2 - 2.2 per 15m; ~5-9/hr)
    05:00–08:00: Gradual increase (2.2 - 4.5 per 15m; ~9-18/hr)
    08:00–12:00: Moderate demand (4.5 - 6.5 per 15m; ~18-26/hr)
    12:00–17:00: Higher demand (6.5 - 8.2 per 15m; ~26-33/hr)
    17:00–22:00: High demand peak (8.0 - 9.6 per 15m; ~32-38/hr)
    22:00–00:00: Gradual decrease (5.5 - 2.2 per 15m; ~22-9/hr)
    """
    time_dec = hour + (minute / 60.0)

    if time_dec < 5.0:
        # Deep night: 1.4 to 1.9
        return 1.5 + 0.3 * math.sin((time_dec / 5.0) * math.pi)
    elif time_dec < 8.0:
        # Early morning rise: 1.8 to 4.2
        ratio = (time_dec - 5.0) / 3.0
        return 1.8 + ratio * 2.5
    elif time_dec < 12.0:
        # Morning demand: 4.3 to 6.2
        ratio = (time_dec - 8.0) / 4.0
        return 4.3 + ratio * 2.0
    elif time_dec < 17.0:
        # Afternoon demand: 6.3 to 7.8
        ratio = (time_dec - 12.0) / 5.0
        return 6.3 + ratio * 1.5
    elif time_dec < 22.0:
        # Evening peak: 7.8 to 9.2, then descending
        ratio = (time_dec - 17.0) / 5.0
        return 7.8 + 1.4 * math.sin(ratio * math.pi)
    else:
        # Late night descent: 6.0 down to 2.0
        ratio = (time_dec - 22.0) / 2.0
        return 5.8 - ratio * 4.0


def get_day_of_week_factor(day_idx: int) -> float:
    """
    Day 0 = Tuesday (Sept 1), Day 6 = Monday (Sept 7), Day 13 = Monday (Sept 14).
    Mondays experience post-weekend volume surges (1.16x).
    Fridays experience weekend prelude surges (1.10x - 1.12x).
    Saturdays experience nightlife & acute injury spikes (1.06x).
    Midweek days represent steady state (0.97x - 1.02x).
    """
    factors = [
        1.00,  # Day 0: Tue (Sept 1)
        0.98,  # Day 1: Wed (Sept 2)
        1.02,  # Day 2: Thu (Sept 3)
        1.10,  # Day 3: Fri (Sept 4) - Evening Surge
        1.06,  # Day 4: Sat (Sept 5)
        1.02,  # Day 5: Sun (Sept 6)
        1.16,  # Day 6: Mon (Sept 7) - Monday Inpatient Bed Gridlock Surge
        0.99,  # Day 7: Tue (Sept 8)
        0.97,  # Day 8: Wed (Sept 9)
        1.01,  # Day 9: Thu (Sept 10)
        1.12,  # Day 10: Fri (Sept 11) - Industrial Incident & Staff Shortage Surge
        1.07,  # Day 11: Sat (Sept 12)
        1.03,  # Day 12: Sun (Sept 13) - Heatwave & Public Gathering Surge
        1.15,  # Day 13: Mon (Sept 14)
    ]
    return factors[day_idx % len(factors)]


def get_shift_staffing(hour: int) -> tuple[int, int, int]:
    """
    Returns (doctors, nurses, support_staff) based on hospital shift pattern.
    - Day shift (07:00–15:00): Full staffing (13-15 docs, 25-29 nurses, 9-12 support)
    - Evening shift (15:00–23:00): Moderate staffing (11-13 docs, 21-25 nurses, 7-10 support)
    - Night shift (23:00–07:00): Lean staffing (7-9 docs, 15-18 nurses, 5-7 support)
    Includes natural Gaussian variation across shifts.
    """
    if 7 <= hour < 15:
        docs = int(np.clip(round(np.random.normal(14.0, 0.7)), 12, 15))
        nurses = int(np.clip(round(np.random.normal(27.0, 1.2)), 24, 30))
        support = int(np.clip(round(np.random.normal(10.5, 0.8)), 8, 12))
    elif 15 <= hour < 23:
        docs = int(np.clip(round(np.random.normal(12.0, 0.7)), 10, 14))
        nurses = int(np.clip(round(np.random.normal(23.0, 1.1)), 19, 26))
        support = int(np.clip(round(np.random.normal(8.5, 0.7)), 6, 10))
    else:
        docs = int(np.clip(round(np.random.normal(8.0, 0.7)), 6, 10))
        nurses = int(np.clip(round(np.random.normal(16.5, 0.9)), 15, 19))
        support = int(np.clip(round(np.random.normal(6.0, 0.6)), 5, 8))

    return docs, nurses, support


def generate_dataset() -> pd.DataFrame:
    """
    Generates all 1,344 sequential observations with causal hospital operations dynamics.
    """
    rows = []

    # State variables initialized to steady-state normal conditions
    current_beds_occupied = 36
    current_patients_waiting = 6
    current_avg_wait_time = 18.0
    current_avg_treatment_time = 32.0

    # History buffers for derived hourly rolling aggregations
    recent_arrivals = [6, 5, 6, 5]
    recent_treated = [6, 6, 5, 6]

    # Definition of 4 realistic Surge Events across the 14-day timeline
    surges = [
        # Surge 1: Day 3 (Fri Sept 4) 18:30–21:15 (11 intervals = 2.75 hrs)
        # Multi-vehicle collision + severe thunderstorm
        {
            "name": "Surge 1: Interstate Pileup & Storm",
            "start": 362,
            "end": 373,
            "peak": 367,
            "arr_mult": 1.90,
            "amb_boost": 3.0,
            "staff_shortage": False,
            "bed_block": False,
        },
        # Surge 2: Day 6 (Mon Sept 7) 12:30–16:30 (16 intervals = 4.0 hrs)
        # Monday Post-Weekend Inpatient Bed Block + Acute Respiratory Outbreak
        # Early-warning ramp starts at interval 622 (11:30)
        {
            "name": "Surge 2: Inpatient Bed-Block & Respiratory Outbreak (Early-Warning Ramp)",
            "start": 622,  # early ramp starts here
            "end": 642,
            "peak": 632,
            "arr_mult": 1.82,
            "amb_boost": 2.2,
            "staff_shortage": False,
            "bed_block": True,
        },
        # Surge 3: Day 10 (Fri Sept 11) 20:00–23:00 (12 intervals = 3.0 hrs)
        # Industrial Hazmat Incident + Nurse Call-Out Shortage
        {
            "name": "Surge 3: Industrial Hazmat & Nursing Shortage",
            "start": 1040,
            "end": 1052,
            "peak": 1046,
            "arr_mult": 2.00,
            "amb_boost": 2.8,
            "staff_shortage": True,
            "bed_block": False,
        },
        # Surge 4: Day 12 (Sun Sept 13) 14:00–16:30 (10 intervals = 2.5 hrs)
        # Heatwave & Outdoor Festival Mass Casualty Incident
        {
            "name": "Surge 4: Heatwave Mass Casualty / Festival Incident",
            "start": 1208,
            "end": 1218,
            "peak": 1213,
            "arr_mult": 1.78,
            "amb_boost": 2.0,
            "staff_shortage": False,
            "bed_block": False,
        },
    ]

    for idx in range(TOTAL_ROWS):
        dt = START_TIMESTAMP + timedelta(minutes=INTERVAL_MINUTES * idx)
        timestamp_str = dt.strftime("%Y-%m-%d %H:%M")
        hour = dt.hour
        minute = dt.minute
        day_idx = idx // INTERVALS_PER_DAY

        # ----------------------------------------------------------------------
        # 1. Staffing with Shift Patterns and Potential Shortages
        # ----------------------------------------------------------------------
        docs, nurses, support = get_shift_staffing(hour)

        # Check for active surge event
        active_surge = None
        surge_intensity = 0.0  # 0.0 to 1.0

        for s in surges:
            if s["start"] <= idx <= s["end"]:
                active_surge = s
                # Smooth curve peaking at peak_idx
                dist = abs(idx - s["peak"])
                half_width = max(1.0, (s["end"] - s["start"]) / 2.0)
                surge_intensity = max(0.0, 1.0 - (dist / half_width) ** 1.3)
                break

        # Check for post-surge recovery period (8 intervals following a surge)
        is_recovery = False
        recovery_intensity = 0.0
        for s in surges:
            if s["end"] < idx <= s["end"] + 8:
                is_recovery = True
                steps_since = idx - s["end"]
                recovery_intensity = 1.0 - (steps_since / 9.0)
                break

        # Apply staff shortage if surge includes it (e.g. Surge 3)
        if active_surge and active_surge["staff_shortage"]:
            docs = max(7, docs - int(round(2 * surge_intensity)))
            nurses = max(15, nurses - int(round(5 * surge_intensity)))
            support = max(5, support - int(round(2 * surge_intensity)))

        # ----------------------------------------------------------------------
        # 2. Patient Arrivals & Ambulance Arrivals
        # ----------------------------------------------------------------------
        base_rate = get_diurnal_base_arrival_rate(hour, minute)
        dow_factor = get_day_of_week_factor(day_idx)

        arrival_lambda = base_rate * dow_factor

        # Surge amplification
        if active_surge:
            mult = 1.0 + (active_surge["arr_mult"] - 1.0) * surge_intensity
            arrival_lambda *= mult
        elif is_recovery:
            # Post-surge lull in new walk-ins
            arrival_lambda *= (0.75 + 0.15 * (1.0 - recovery_intensity))

        # Add natural stochastic variation (Poisson)
        arrived_raw = np.random.poisson(max(0.5, arrival_lambda))
        patients_arrived = int(max(0, arrived_raw))

        # Ambulance arrivals (typically 8% - 18%, spiking to 25% - 35% in surges)
        if patients_arrived == 0:
            ambulance_arrivals = 0
        else:
            base_amb_ratio = 0.10 + 0.04 * math.sin((hour / 24.0) * 2 * math.pi)
            if active_surge:
                base_amb_ratio = min(0.35, base_amb_ratio + 0.12 * surge_intensity)
                amb_extra = int(round(active_surge["amb_boost"] * surge_intensity))
            else:
                amb_extra = 0

            calculated_amb = int(round(patients_arrived * base_amb_ratio)) + amb_extra
            # Strict constraint: ambulance_arrivals <= patients_arrived
            ambulance_arrivals = int(np.clip(calculated_amb, 0, patients_arrived))

        # ----------------------------------------------------------------------
        # 3. Operational Treatment Capacity & Patients Treated
        # ----------------------------------------------------------------------
        # Treatment capacity per 15-min interval depends on available staff & beds
        available_beds = BEDS_TOTAL - current_beds_occupied
        bed_factor = (max(1, available_beds) / float(BEDS_TOTAL)) ** 0.16

        # Congestion friction slowdown
        occupancy_ratio = current_beds_occupied / float(BEDS_TOTAL)
        congestion_friction = 1.0 - 0.20 * (occupancy_ratio**2)

        # Baseline capacity: physicians manage clinical treatment progression
        # In 15 min, each doctor advances ~0.50 patients; nurses support ~0.12 patients
        base_capacity = (0.50 * docs + 0.12 * nurses + 0.08 * support) * bed_factor * congestion_friction

        # If waiting queue is high, triage efficiency and fast-track processing kick in
        if current_patients_waiting > 14:
            queue_urgency = min(1.25, 1.0 + 0.015 * (current_patients_waiting - 14))
            base_capacity *= queue_urgency

        treatment_capacity = max(1, int(round(np.random.normal(base_capacity, 0.9))))

        # Total patient pool available to be treated in this interval
        total_available_for_treatment = current_patients_waiting + patients_arrived
        patients_treated = int(min(treatment_capacity, total_available_for_treatment))

        # ----------------------------------------------------------------------
        # 4. Patient Waiting Queue Dynamics (Exact Mass Conservation)
        # ----------------------------------------------------------------------
        # patients_waiting(t) = max(0, patients_waiting(t-1) + arrived - treated)
        new_patients_waiting = max(0, current_patients_waiting + patients_arrived - patients_treated)

        # ----------------------------------------------------------------------
        # 5. Inpatient Admissions and Discharges (Bed Homeostasis)
        # ----------------------------------------------------------------------
        # Admissions: subset of treated patients needing inpatient hospitalization
        # Typically 18% to 26% of treated patients; higher during severe surges
        admission_rate = 0.21 + 0.04 * (hour / 24.0)
        if active_surge:
            admission_rate = min(0.38, admission_rate + 0.12 * surge_intensity)

        raw_admissions = int(round(patients_treated * admission_rate + np.random.normal(0, 0.5)))
        # Strict constraints: admissions >= 0 and admissions <= patients_treated
        admissions = int(np.clip(raw_admissions, 0, patients_treated))

        # Discharges: freeing hospital beds
        # Main hospital discharge rounds occur between 10:00 and 17:00
        if 10 <= hour <= 16:
            base_discharges = 2.0
        elif 8 <= hour < 10 or 17 < hour <= 20:
            base_discharges = 1.3
        else:
            base_discharges = 0.6

        # Homeostatic bed management:
        # If beds_occupied > 45, hospital inpatient management expedites bed turnarounds
        if current_beds_occupied > 45:
            base_discharges += (current_beds_occupied - 45) * 0.07
        elif current_beds_occupied < 32:
            base_discharges -= (32 - current_beds_occupied) * 0.04

        # Surge 2 feature: Inpatient bed block severely restricts discharges
        if active_surge and active_surge["bed_block"]:
            base_discharges *= 0.30
        elif is_recovery:
            # Hospital initiates rapid decompression discharge push
            base_discharges += 2.0 * recovery_intensity

        raw_discharges = int(round(np.random.normal(base_discharges, 0.6)))
        discharges = int(max(0, raw_discharges))

        # Update bed occupancy with strictly maintained boundaries [20, 70]
        potential_beds_occupied = current_beds_occupied + admissions - discharges
        beds_occupied = int(np.clip(potential_beds_occupied, 20, BEDS_TOTAL))
        beds_available = BEDS_TOTAL - beds_occupied

        # ----------------------------------------------------------------------
        # 6. Derived Hourly Rates (Rolling 1-Hour Sums)
        # ----------------------------------------------------------------------
        recent_arrivals.append(patients_arrived)
        recent_treated.append(patients_treated)
        if len(recent_arrivals) > 4:
            recent_arrivals.pop(0)
            recent_treated.pop(0)

        arrival_rate_per_hour = sum(recent_arrivals)
        treatment_rate_per_hour = sum(recent_treated)

        # ----------------------------------------------------------------------
        # 7. Operational Metrics: Bed Occupancy & Staff Capacity Score
        # ----------------------------------------------------------------------
        bed_occupancy_rate = round(float(beds_occupied) / float(BEDS_TOTAL), 4)

        # Staff capacity score: ratio of available staffing to nominal full staffing,
        # penalized by active patient workload strain
        base_staff_score = 0.35 * (docs / 15.0) + 0.45 * (nurses / 30.0) + 0.20 * (support / 12.0)
        active_patient_load = beds_occupied + new_patients_waiting
        workload_strain = max(0.0, (active_patient_load - 50.0) * 0.005)
        staff_capacity_score = round(float(np.clip(base_staff_score - workload_strain, 0.25, 1.0)), 4)

        # ----------------------------------------------------------------------
        # 8. Average Wait Time & Treatment Time (Smooth Continuous Tracking)
        # ----------------------------------------------------------------------
        # Target wait time derived from Little's Law queue length + bed boarding delay
        queue_ratio = new_patients_waiting / max(1.0, treatment_rate_per_hour / 4.0)
        wait_target = 13.0 + queue_ratio * 13.5
        # Bed boarding penalty when occupancy > 74%
        if bed_occupancy_rate > 0.74:
            wait_target += (bed_occupancy_rate - 0.74) * 85.0
        # Staff strain penalty
        if staff_capacity_score < 0.72:
            wait_target += (0.72 - staff_capacity_score) * 35.0

        # Smooth exponential moving average to eliminate sudden non-physical jumps
        current_avg_wait_time = 0.75 * current_avg_wait_time + 0.25 * wait_target + np.random.normal(0, 0.7)
        average_wait_time = round(float(np.clip(current_avg_wait_time, 10.0, 120.0)), 1)

        # Treatment time (20 to 56 minutes, prolonged under high congestion)
        treatment_target = 27.0 + 14.0 * bed_occupancy_rate + 7.0 * (1.0 - staff_capacity_score)
        current_avg_treatment_time = 0.82 * current_avg_treatment_time + 0.18 * treatment_target + np.random.normal(0, 0.5)
        average_treatment_time = round(float(np.clip(current_avg_treatment_time, 18.0, 58.0)), 1)

        # ----------------------------------------------------------------------
        # 9. Congestion Score (0 to 100 Multi-Dimensional Synthetic Index)
        # ----------------------------------------------------------------------
        # Bed pressure: scaled from 48% occupancy (0) to 92% occupancy (100)
        c_bed = np.clip((bed_occupancy_rate - 0.48) / 0.44, 0.0, 1.0) * 100.0

        # Queue pressure: scaled from 3 to 28 waiting patients
        c_queue = np.clip((new_patients_waiting - 3.0) / 25.0, 0.0, 1.0) * 100.0

        # Wait time pressure: scaled from 16m to 62m
        c_wait = np.clip((average_wait_time - 16.0) / 46.0, 0.0, 1.0) * 100.0

        # Flow imbalance: arrival rate vs treatment rate
        imbalance = arrival_rate_per_hour - treatment_rate_per_hour
        c_flow = np.clip((imbalance + 2.0) / 18.0, 0.0, 1.0) * 100.0

        # Staff pressure
        c_staff = np.clip((0.92 - staff_capacity_score) / 0.55, 0.0, 1.0) * 100.0

        # Recent arrival volume momentum
        c_momentum = np.clip((arrival_rate_per_hour - 18.0) / 22.0, 0.0, 1.0) * 100.0

        weighted_congestion = (
            0.26 * c_bed +
            0.24 * c_queue +
            0.22 * c_wait +
            0.14 * c_flow +
            0.08 * c_staff +
            0.06 * c_momentum
        )
        congestion_score = round(float(np.clip(weighted_congestion, 0.0, 100.0)), 1)

        # Update state variables for next iteration
        current_beds_occupied = beds_occupied
        current_patients_waiting = new_patients_waiting

        rows.append({
            "timestamp": timestamp_str,
            "patients_arrived": patients_arrived,
            "ambulance_arrivals": ambulance_arrivals,
            "patients_waiting": new_patients_waiting,
            "patients_treated": patients_treated,
            "beds_total": BEDS_TOTAL,
            "beds_occupied": beds_occupied,
            "beds_available": beds_available,
            "doctors_available": docs,
            "nurses_available": nurses,
            "support_staff_available": support,
            "average_wait_time": average_wait_time,
            "average_treatment_time": average_treatment_time,
            "admissions": admissions,
            "discharges": discharges,
            "arrival_rate_per_hour": arrival_rate_per_hour,
            "treatment_rate_per_hour": treatment_rate_per_hour,
            "bed_occupancy_rate": bed_occupancy_rate,
            "staff_capacity_score": staff_capacity_score,
            "congestion_score": congestion_score,
            "high_congestion_next_60min": 0,
        })

    df = pd.DataFrame(rows)

    # --------------------------------------------------------------------------
    # 10. Machine Learning Target: high_congestion_next_60min
    # --------------------------------------------------------------------------
    # Defined strictly on FUTURE conditions (next 60 minutes = next 4 intervals).
    # For row i, look forward across intervals i+1, i+2, i+3, i+4.
    # If any interval reaches congestion_score >= HIGH_CONGESTION_THRESHOLD, set to 1.
    # Note: Current row i features DO NOT leak this forward information.
    targets = []
    n = len(df)
    congestion_vals = df["congestion_score"].values

    for i in range(n):
        forward_start = i + 1
        forward_end = min(n, i + 5)
        if forward_start < n:
            future_window = congestion_vals[forward_start:forward_end]
            is_high = int(np.any(future_window >= HIGH_CONGESTION_THRESHOLD))
        else:
            is_high = 0
        targets.append(is_high)

    df["high_congestion_next_60min"] = targets
    return df


def validate_dataset(df: pd.DataFrame) -> dict:
    """
    Executes all 17 rigorous operational and data quality validation checks.
    """
    checks = []

    # 1. Exactly 1,344 rows
    c1 = len(df) == 1344
    checks.append(("Exactly 1,344 rows", c1, f"Found {len(df)} rows"))

    # 2. No duplicate timestamps
    c2 = df["timestamp"].duplicated().sum() == 0
    checks.append(("No duplicate timestamps", c2, f"Duplicates: {df['timestamp'].duplicated().sum()}"))

    # 3. No missing timestamps (consecutive 15-minute sequence)
    ts = pd.to_datetime(df["timestamp"])
    diffs = ts.diff().dropna()
    c3 = (diffs == pd.Timedelta(minutes=15)).all()
    checks.append(("Continuous 15-minute intervals without gaps", c3, f"Non-15m intervals: {(diffs != pd.Timedelta(minutes=15)).sum()}"))

    # 4. beds_available = beds_total - beds_occupied
    bed_diff = (df["beds_available"] - (df["beds_total"] - df["beds_occupied"])).abs().sum()
    c4 = bed_diff == 0
    checks.append(("beds_available == beds_total - beds_occupied strictly", c4, f"Deviations: {bed_diff}"))

    # 5. beds_occupied between 0 and 70 (operational target 20 to 70)
    c5 = (df["beds_occupied"] >= 20).all() and (df["beds_occupied"] <= 70).all()
    checks.append(("beds_occupied strictly within 20..70", c5, f"Min: {df['beds_occupied'].min()}, Max: {df['beds_occupied'].max()}"))

    # 6. congestion_score between 0 and 100
    c6 = (df["congestion_score"] >= 0).all() and (df["congestion_score"] <= 100).all()
    checks.append(("congestion_score strictly within 0..100", c6, f"Min: {df['congestion_score'].min()}, Max: {df['congestion_score'].max()}"))

    # 7. staff_capacity_score between 0 and 1
    c7 = (df["staff_capacity_score"] >= 0.0).all() and (df["staff_capacity_score"] <= 1.0).all()
    checks.append(("staff_capacity_score strictly within 0..1", c7, f"Min: {df['staff_capacity_score'].min()}, Max: {df['staff_capacity_score'].max()}"))

    # 8. high_congestion_next_60min contains only 0 or 1
    c8 = set(df["high_congestion_next_60min"].unique()).issubset({0, 1})
    checks.append(("high_congestion_next_60min binary (only 0 or 1)", c8, f"Unique: {df['high_congestion_next_60min'].unique()}"))

    # 9. ambulance_arrivals <= patients_arrived
    c9 = (df["ambulance_arrivals"] <= df["patients_arrived"]).all()
    checks.append(("ambulance_arrivals <= patients_arrived strictly", c9, f"Violations: {(df['ambulance_arrivals'] > df['patients_arrived']).sum()}"))

    # 10. admissions <= patients_treated
    c10 = (df["admissions"] <= df["patients_treated"]).all()
    checks.append(("admissions <= patients_treated strictly", c10, f"Violations: {(df['admissions'] > df['patients_treated']).sum()}"))

    # 11. No negative patient counts
    neg_patients = (
        (df["patients_arrived"] < 0).sum() +
        (df["ambulance_arrivals"] < 0).sum() +
        (df["patients_waiting"] < 0).sum() +
        (df["patients_treated"] < 0).sum()
    )
    c11 = neg_patients == 0
    checks.append(("No negative patient counts", c11, f"Negative patient counts: {neg_patients}"))

    # 12. No negative bed counts
    neg_beds = (df["beds_occupied"] < 0).sum() + (df["beds_available"] < 0).sum()
    c12 = neg_beds == 0
    checks.append(("No negative bed counts", c12, f"Negative bed counts: {neg_beds}"))

    # 13. Average wait times are plausible (10 to 120 mins)
    c13 = (df["average_wait_time"] >= 10.0).all() and (df["average_wait_time"] <= 120.0).all()
    checks.append(("average_wait_time plausible (10 to 120 mins)", c13, f"Min: {df['average_wait_time'].min()}m, Max: {df['average_wait_time'].max()}m"))

    # 14. Arrival and treatment rates plausible
    c14 = (df["arrival_rate_per_hour"] >= 0).all() and (df["treatment_rate_per_hour"] >= 0).all()
    checks.append(("Hourly arrival and treatment rates plausible", c14, f"Max arrival/h: {df['arrival_rate_per_hour'].max()}, Max treat/h: {df['treatment_rate_per_hour'].max()}"))

    # 15. Surge events actually exist (congestion >= 80)
    surge_count = (df["congestion_score"] >= 80.0).sum()
    c15 = surge_count >= 10
    checks.append(("Surge events exist (congestion_score >= 80)", c15, f"Intervals with congestion >= 80: {surge_count}"))

    # 16. Both high-congestion and low-congestion periods exist
    low_count = (df["congestion_score"] < 40.0).sum()
    high_count = (df["congestion_score"] >= HIGH_CONGESTION_THRESHOLD).sum()
    c16 = low_count > 100 and high_count > 50
    checks.append(("Both high and low congestion periods represented", c16, f"Low (<40): {low_count}, High (>={HIGH_CONGESTION_THRESHOLD}): {high_count}"))

    # 17. Target not 100% one class & balanced within ~15-30%
    target_pos = df["high_congestion_next_60min"].sum()
    pos_pct = (target_pos / len(df)) * 100.0
    c17 = 15.0 <= pos_pct <= 30.0
    checks.append(("Target balance suitable for ML classification (15-30% range)", c17, f"Positives: {target_pos} ({pos_pct:.1f}%)"))

    all_passed = all(c[1] for c in checks)
    return {
        "all_passed": all_passed,
        "checks": checks,
        "pos_count": target_pos,
        "pos_pct": pos_pct,
    }


def main():
    print("=" * 80)
    print("ER-AEGIS Synthetic Hospital Operations Dataset Generator")
    print("=" * 80)
    print(f"Random Seed: {RANDOM_SEED}")
    print(f"Total Intervals: {TOTAL_ROWS} (14 days @ 15-minute frequency)")
    print(f"Hospital ED Beds: {BEDS_TOTAL}")
    print(f"High Congestion Threshold: {HIGH_CONGESTION_THRESHOLD}")

    print("\nGenerating realistic operational time series...")
    df = generate_dataset()

    output_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(output_dir, "hospital_data.csv")

    df.to_csv(csv_path, index=False)
    print(f"Saved dataset successfully to: {csv_path}")

    print("\nRunning automated data quality verification suite (17 checks)...")
    val = validate_dataset(df)

    for i, (name, passed, detail) in enumerate(val["checks"], 1):
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  Check {i:02d}: {status} {name.ljust(55)} -> {detail}")

    print("\nValidation Result:", "ALL 17 CHECKS PASSED!" if val["all_passed"] else "VALIDATION FAILED!")

    # Dataset Summary Statistics
    print("\n" + "=" * 80)
    print("DATASET SUMMARY STATISTICS")
    print("=" * 80)
    print(f"Total Rows:                   {len(df)}")
    print(f"Total Columns:                {len(df.columns)}")
    print(f"Date Range:                   {df['timestamp'].iloc[0]}  to  {df['timestamp'].iloc[-1]}")
    print(f"Congestion Score Range:       Min: {df['congestion_score'].min():.1f} | Max: {df['congestion_score'].max():.1f} | Mean: {df['congestion_score'].mean():.1f}")
    print(f"Wait Time Range:              Min: {df['average_wait_time'].min():.1f}m | Max: {df['average_wait_time'].max():.1f}m | Mean: {df['average_wait_time'].mean():.1f}m")
    print(f"Bed Occupancy Rate:           Min: {df['bed_occupancy_rate'].min():.2%} | Max: {df['bed_occupancy_rate'].max():.2%} | Mean: {df['bed_occupancy_rate'].mean():.2%}")
    print(f"High Congestion Target (=1):  {val['pos_count']} of {len(df)} rows ({val['pos_pct']:.1f}%)")
    print(f"Normal Target (=0):           {len(df) - val['pos_count']} of {len(df)} rows ({100.0 - val['pos_pct']:.1f}%)")
    print(f"Surge Events Modeled:         4 major distinct surge events (2.5h to 4h each)")

    print("\nFirst 10 Rows of hospital_data.csv:")
    print("-" * 80)
    pd.set_option("display.max_columns", None)
    pd.set_option("display.width", 1000)
    print(df.head(10)[["timestamp", "patients_arrived", "ambulance_arrivals", "patients_waiting", "patients_treated", "beds_occupied", "beds_available", "doctors_available", "nurses_available", "average_wait_time", "congestion_score", "high_congestion_next_60min"]])
    print("-" * 80)


if __name__ == "__main__":
    main()
