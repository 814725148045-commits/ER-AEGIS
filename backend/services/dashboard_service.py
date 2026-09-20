"""
Dashboard and Operational Telemetry Service for ER-AEGIS FastAPI Backend
Handles live snapshot extraction, historical trend slicing, resource calculation,
operational alert generation, recommendations, and scenario simulations.
"""

import os
from typing import Dict, Any, List, Optional
import pandas as pd
from .prediction_service import get_prediction_service

SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SERVICE_DIR, ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, "data", "hospital_data.csv")


class DashboardService:
    def __init__(self, data_path: str = DATA_PATH):
        self.data_path = data_path
        self._df: Optional[pd.DataFrame] = None
        self._load_data()

    def _load_data(self):
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Hospital data CSV not found at: {self.data_path}")
        df = pd.read_csv(self.data_path)
        df["timestamp_dt"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp_dt").reset_index(drop=True)
        self._df = df
        print(f"[ER-AEGIS Backend] Loaded {len(self._df)} chronological records from {self.data_path}")

    @property
    def df(self) -> pd.DataFrame:
        if self._df is None:
            self._load_data()
        return self._df

    def get_latest_row(self) -> Dict[str, Any]:
        return self.df.iloc[-1].to_dict()

    def get_dashboard_data(self) -> Dict[str, Any]:
        pred_service = get_prediction_service()
        row = self.get_latest_row()
        prediction = pred_service.predict(row)

        return {
            "timestamp": str(row.get("timestamp", "")),
            "patients_waiting": int(row.get("patients_waiting", 0)),
            "patients_arrived": int(row.get("patients_arrived", 0)),
            "patients_treated": int(row.get("patients_treated", 0)),
            "beds_total": int(row.get("beds_total", 70)),
            "beds_occupied": int(row.get("beds_occupied", 0)),
            "beds_available": int(row.get("beds_available", 0)),
            "doctors_available": int(row.get("doctors_available", 0)),
            "nurses_available": int(row.get("nurses_available", 0)),
            "support_staff_available": int(row.get("support_staff_available", 0)),
            "average_wait_time": round(float(row.get("average_wait_time", 0.0)), 1),
            "average_treatment_time": round(float(row.get("average_treatment_time", 0.0)), 1),
            "congestion_score": round(float(row.get("congestion_score", 0.0)), 1),
            "bed_occupancy_rate": round(float(row.get("bed_occupancy_rate", 0.0)), 4),
            "staff_capacity_score": round(float(row.get("staff_capacity_score", 0.0)), 4),
            "prediction": prediction,
        }

    def get_history(self, limit: int = 96) -> List[Dict[str, Any]]:
        limit = max(1, min(limit, len(self.df)))
        sub_df = self.df.iloc[-limit:]
        
        records = []
        for _, r in sub_df.iterrows():
            records.append({
                "timestamp": str(r["timestamp"]),
                "patients_arrived": int(r["patients_arrived"]),
                "patients_waiting": int(r["patients_waiting"]),
                "patients_treated": int(r["patients_treated"]),
                "beds_occupied": int(r["beds_occupied"]),
                "beds_available": int(r["beds_available"]),
                "average_wait_time": round(float(r["average_wait_time"]), 1),
                "congestion_score": round(float(r["congestion_score"]), 1),
                "bed_occupancy_rate": round(float(r["bed_occupancy_rate"]), 4),
            })
        return records

    def get_forecast(self) -> Dict[str, Any]:
        pred_service = get_prediction_service()
        row = self.get_latest_row()
        pred = pred_service.predict(row)

        return {
            "horizon_minutes": 60,
            "congestion_probability": pred["congestion_probability"],
            "predicted_congestion_level": pred["predicted_congestion_level"],
            "risk_level": pred["risk_level"],
            "model_name": pred["model_name"],
            "generated_at": pred.get("generated_at"),
            "notice": "ER-AEGIS model is trained specifically for 60-minute prediction horizon",
        }

    def get_resources(self) -> Dict[str, Any]:
        row = self.get_latest_row()
        return {
            "beds": {
                "total": int(row.get("beds_total", 70)),
                "occupied": int(row.get("beds_occupied", 0)),
                "available": int(row.get("beds_available", 0)),
            },
            "staff": {
                "doctors": int(row.get("doctors_available", 0)),
                "nurses": int(row.get("nurses_available", 0)),
                "support_staff": int(row.get("support_staff_available", 0)),
            },
        }

    def get_alerts(self) -> List[Dict[str, Any]]:
        row = self.get_latest_row()
        pred_service = get_prediction_service()
        pred = pred_service.predict(row)

        alerts = []
        # 1. Congestion Risk Alert
        if pred["risk_level"] in ["HIGH", "CRITICAL"]:
            alerts.append({
                "id": "congestion-risk",
                "severity": pred["risk_level"],
                "type": "HIGH_CONGESTION_RISK",
                "message": f"AI model predicts elevated congestion risk ({pred['congestion_probability']*100:.1f}%) within 60 minutes.",
            })
        elif pred["risk_level"] == "MODERATE":
            alerts.append({
                "id": "congestion-risk",
                "severity": "MODERATE",
                "type": "MODERATE_CONGESTION_RISK",
                "message": f"AI model indicates moderate congestion risk ({pred['congestion_probability']*100:.1f}%) developing.",
            })

        # 2. Bed Availability Alert
        beds_avail = int(row.get("beds_available", 0))
        bed_occ = float(row.get("bed_occupancy_rate", 0.0))
        if beds_avail <= 6:
            alerts.append({
                "id": "low-bed-availability",
                "severity": "CRITICAL" if beds_avail <= 3 else "HIGH",
                "type": "LOW_BED_AVAILABILITY",
                "message": f"Acute bed availability critical: only {beds_avail} beds remaining ({bed_occ*100:.1f}% capacity).",
            })
        elif beds_avail <= 12 or bed_occ >= 0.82:
            alerts.append({
                "id": "low-bed-availability",
                "severity": "MODERATE",
                "type": "LOW_BED_AVAILABILITY",
                "message": f"Bed reserve tightening: {beds_avail} beds open ({bed_occ*100:.1f}% occupied).",
            })

        # 3. Wait Time Alert
        avg_wait = float(row.get("average_wait_time", 0.0))
        if avg_wait >= 55.0:
            alerts.append({
                "id": "high-wait-time",
                "severity": "HIGH",
                "type": "HIGH_WAIT_TIME",
                "message": f"Average door-to-doctor wait time escalated to {avg_wait:.0f} minutes.",
            })
        elif avg_wait >= 40.0:
            alerts.append({
                "id": "high-wait-time",
                "severity": "MODERATE",
                "type": "HIGH_WAIT_TIME",
                "message": f"Average wait time elevated at {avg_wait:.0f} minutes.",
            })

        # 4. Staff Pressure Alert
        staff_cap = float(row.get("staff_capacity_score", 1.0))
        if staff_cap <= 0.45:
            alerts.append({
                "id": "staff-pressure",
                "severity": "HIGH",
                "type": "STAFF_PRESSURE",
                "message": f"Staff capacity score strained at {staff_cap:.2f} relative to triage volume.",
            })
        elif staff_cap <= 0.60:
            alerts.append({
                "id": "staff-pressure",
                "severity": "MODERATE",
                "type": "STAFF_PRESSURE",
                "message": f"Clinical staffing utilization elevated ({staff_cap:.2f} capacity ratio).",
            })

        return alerts

    def get_recommendations(self) -> Dict[str, Any]:
        row = self.get_latest_row()
        pred_service = get_prediction_service()
        pred = pred_service.predict(row)

        recs = []
        beds_avail = int(row.get("beds_available", 0))
        bed_occ = float(row.get("bed_occupancy_rate", 0.0))
        patients_waiting = int(row.get("patients_waiting", 0))
        avg_wait = float(row.get("average_wait_time", 0.0))
        staff_cap = float(row.get("staff_capacity_score", 1.0))

        # Bed capacity recommendation
        if beds_avail <= 12 or bed_occ >= 0.80:
            recs.append({
                "title": "Review bed turnover and prioritize discharge processing",
                "reason": "Acute bed occupancy is high, creating potential admission boarding delays.",
                "evidence": {
                    "beds_available": beds_avail,
                    "bed_occupancy_rate": round(bed_occ, 3),
                    "congestion_probability": pred["congestion_probability"],
                },
            })

        # Queue management recommendation
        if patients_waiting >= 15 or avg_wait >= 35.0:
            recs.append({
                "title": "Consider reallocating available operational staff toward high-throughput intake",
                "reason": "Waiting queue velocity is contributing to extended door-to-provider wait intervals.",
                "evidence": {
                    "patients_waiting": patients_waiting,
                    "average_wait_time": round(avg_wait, 1),
                    "nurses_available": int(row.get("nurses_available", 0)),
                },
            })

        # Staff allocation recommendation
        if staff_cap <= 0.65:
            recs.append({
                "title": "Review current staffing allocation and prepare on-call reserves",
                "reason": "Provider-to-patient ratio indicates emerging triage and observation bottleneck.",
                "evidence": {
                    "staff_capacity_score": round(staff_cap, 3),
                    "doctors_available": int(row.get("doctors_available", 0)),
                    "nurses_available": int(row.get("nurses_available", 0)),
                },
            })

        # Pre-surge protocol recommendation
        if pred["congestion_probability"] >= 0.65:
            recs.append({
                "title": "Initiate pre-surge operational protocol with charge coordinator",
                "reason": "ML forecast indicates high probability of severe congestion within the 60-minute horizon.",
                "evidence": {
                    "congestion_probability": pred["congestion_probability"],
                    "risk_level": pred["risk_level"],
                    "prediction_horizon_minutes": 60,
                },
            })

        # Fallback baseline recommendation if all metrics are optimal
        if not recs:
            recs.append({
                "title": "Maintain standard operational monitoring",
                "reason": "All ED operational metrics and ML forecasts currently indicate nominal capacity.",
                "evidence": {
                    "congestion_probability": pred["congestion_probability"],
                    "beds_available": beds_avail,
                    "average_wait_time": avg_wait,
                },
            })

        return {"recommendations": recs}

    def run_simulation(
        self,
        additional_doctors: int = 0,
        additional_nurses: int = 0,
        additional_beds: int = 0,
        arrival_increase_percent: float = 0.0,
    ) -> Dict[str, Any]:
        pred_service = get_prediction_service()
        base_row = self.get_latest_row()
        base_pred = pred_service.predict(base_row)

        # Clone baseline operational state for intervention modeling
        scenario_data = dict(base_row)

        # 1. Staffing intervention
        new_docs = int(scenario_data.get("doctors_available", 8)) + additional_doctors
        new_nurses = int(scenario_data.get("nurses_available", 19)) + additional_nurses
        scenario_data["doctors_available"] = new_docs
        scenario_data["nurses_available"] = new_nurses

        # Staff capacity improves with added clinicians
        base_staff_cap = float(scenario_data.get("staff_capacity_score", 0.7))
        staff_boost = (additional_doctors * 0.035) + (additional_nurses * 0.02)
        new_staff_cap = min(1.0, base_staff_cap + staff_boost)
        scenario_data["staff_capacity_score"] = new_staff_cap

        # 2. Bed expansion intervention
        base_beds_total = int(scenario_data.get("beds_total", 70))
        new_beds_total = base_beds_total + additional_beds
        scenario_data["beds_total"] = new_beds_total

        base_occupied = int(scenario_data.get("beds_occupied", 50))
        # Additional beds add to immediate availability
        scenario_data["beds_available"] = int(scenario_data.get("beds_available", 20)) + additional_beds
        scenario_data["bed_occupancy_rate"] = min(1.0, max(0.0, base_occupied / max(1, new_beds_total)))

        # 3. Patient arrival surge / reduction intervention
        arrival_mult = 1.0 + (arrival_increase_percent / 100.0)
        scenario_data["patients_arrived"] = max(0, int(round(scenario_data.get("patients_arrived", 4) * arrival_mult)))
        scenario_data["arrival_rate_per_hour"] = max(0.0, float(scenario_data.get("arrival_rate_per_hour", 16.0) * arrival_mult))
        scenario_data["patients_arrived_last_1h"] = float(scenario_data["arrival_rate_per_hour"])
        scenario_data["patients_arrived_last_2h"] = float(scenario_data["arrival_rate_per_hour"] * 2.0)

        # Treatment rate and wait time shift under interventions
        if arrival_increase_percent > 0:
            scenario_data["patients_waiting"] = int(scenario_data.get("patients_waiting", 15) * (1.0 + arrival_increase_percent / 150.0))
            scenario_data["average_wait_time"] = float(scenario_data.get("average_wait_time", 30.0) * (1.0 + arrival_increase_percent / 200.0))
        elif arrival_increase_percent < 0:
            scenario_data["patients_waiting"] = max(2, int(scenario_data.get("patients_waiting", 15) * (1.0 + arrival_increase_percent / 100.0)))
            scenario_data["average_wait_time"] = max(10.0, float(scenario_data.get("average_wait_time", 30.0) * (1.0 + arrival_increase_percent / 100.0)))

        if additional_doctors > 0 or additional_nurses > 0:
            scenario_data["treatment_rate_per_hour"] = float(scenario_data.get("treatment_rate_per_hour", 16.0) * (1.0 + staff_boost * 0.5))
            scenario_data["average_wait_time"] = max(10.0, scenario_data["average_wait_time"] * (1.0 - staff_boost * 0.3))

        scenario_pred = pred_service.predict(scenario_data)

        base_p = base_pred["congestion_probability"]
        scen_p = scenario_pred["congestion_probability"]
        diff = round(scen_p - base_p, 4)

        return {
            "baseline": {
                "congestion_probability": base_p,
            },
            "scenario": {
                "congestion_probability": scen_p,
            },
            "change": {
                "probability_difference": diff,
            },
            "assumptions": {
                "simulated_additional_doctors": additional_doctors,
                "simulated_additional_nurses": additional_nurses,
                "simulated_additional_beds": additional_beds,
                "simulated_arrival_change_percent": arrival_increase_percent,
                "disclaimer": "Transparent prototype simulation mapping interventions to Random Forest operational input features.",
            },
        }


# Global singleton instance
_dashboard_service_instance = None


def get_dashboard_service() -> DashboardService:
    global _dashboard_service_instance
    if _dashboard_service_instance is None:
        _dashboard_service_instance = DashboardService()
    return _dashboard_service_instance
