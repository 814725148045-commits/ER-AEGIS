"""
Pydantic Schemas for ER-AEGIS FastAPI Service
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "ER-AEGIS API"
    model_loaded: bool = True


class PredictionRequest(BaseModel):
    patients_arrived: int = Field(..., ge=0, description="Patient arrivals in current interval")
    ambulance_arrivals: int = Field(0, ge=0, description="EMS arrivals in current interval")
    patients_waiting: int = Field(..., ge=0, description="Patients currently in waiting room queue")
    patients_treated: int = Field(..., ge=0, description="Patients treated in current interval")
    beds_occupied: int = Field(..., ge=0, description="Acute care beds currently occupied")
    beds_available: int = Field(..., ge=0, description="Beds currently available")
    doctors_available: int = Field(..., ge=0, description="Active emergency physicians")
    nurses_available: int = Field(..., ge=0, description="Active emergency registered nurses")
    support_staff_available: int = Field(..., ge=0, description="Support staff on duty")
    average_wait_time: float = Field(..., ge=0.0, description="Average door-to-doctor wait time in minutes")
    average_treatment_time: float = Field(..., ge=0.0, description="Average treatment duration in minutes")
    admissions: int = Field(..., ge=0, description="Inpatient admissions from ED")
    discharges: int = Field(..., ge=0, description="Discharges freeing beds")
    arrival_rate_per_hour: float = Field(..., ge=0.0, description="Rolling 1-hour arrival count")
    treatment_rate_per_hour: float = Field(..., ge=0.0, description="Rolling 1-hour treatment throughput")
    bed_occupancy_rate: float = Field(..., ge=0.0, le=1.0, description="Bed occupancy ratio (0.0 to 1.0)")
    staff_capacity_score: float = Field(..., ge=0.0, le=1.0, description="Staff capacity ratio (0.0 to 1.0)")
    congestion_score: float = Field(..., ge=0.0, le=100.0, description="Composite congestion score (0 to 100)")
    
    # Optional recent trend overrides
    patients_arrived_last_1h: Optional[float] = None
    patients_arrived_last_2h: Optional[float] = None
    patients_treated_last_1h: Optional[float] = None
    patients_waiting_change_1h: Optional[float] = None
    congestion_score_change_1h: Optional[float] = None
    bed_occupancy_change_1h: Optional[float] = None
    wait_time_change_1h: Optional[float] = None

    @model_validator(mode="after")
    def validate_bed_constraints(self):
        if self.beds_occupied > 70:
            raise ValueError(f"beds_occupied ({self.beds_occupied}) cannot exceed total capacity of 70")
        if self.ambulance_arrivals > self.patients_arrived:
            raise ValueError("ambulance_arrivals cannot exceed total patients_arrived")
        return self


class PredictionResponse(BaseModel):
    congestion_probability: float = Field(..., description="Probability of high congestion in next 60 min")
    predicted_congestion: bool = Field(..., description="True if probability >= 0.50")
    predicted_congestion_level: str = Field("LOW", description="Risk level string")
    risk_level: str = Field(..., description="LOW, MODERATE, HIGH, or CRITICAL")
    horizon_minutes: int = Field(60, description="Prediction lookahead horizon in minutes")
    prediction_horizon_minutes: int = Field(60, description="Prediction lookahead horizon in minutes")
    model_name: str = Field("RandomForestClassifier (28 features, 60-min horizon)", description="Model name")
    generated_at: Optional[str] = Field(None, description="Timestamp of inference")


class DashboardResponse(BaseModel):
    timestamp: str
    patients_waiting: int
    patients_arrived: int
    patients_treated: int
    beds_total: int
    beds_occupied: int
    beds_available: int
    doctors_available: int
    nurses_available: int
    support_staff_available: int
    average_wait_time: float
    average_treatment_time: float
    congestion_score: float
    bed_occupancy_rate: float
    staff_capacity_score: float
    prediction: PredictionResponse


class HistoryRecord(BaseModel):
    timestamp: str
    patients_arrived: int
    patients_waiting: int
    patients_treated: int
    beds_occupied: int
    beds_available: int
    average_wait_time: float
    congestion_score: float
    bed_occupancy_rate: float


class ForecastResponse(BaseModel):
    horizon_minutes: int = 60
    congestion_probability: float
    predicted_congestion_level: str = "LOW"
    risk_level: str
    model_name: str = "RandomForestClassifier (28 features, 60-min horizon)"
    generated_at: Optional[str] = None
    notice: Optional[str] = "ER-AEGIS model is trained specifically for 60-minute prediction horizon"


class BedResources(BaseModel):
    total: int
    occupied: int
    available: int


class StaffResources(BaseModel):
    doctors: int
    nurses: int
    support_staff: int


class ResourcesResponse(BaseModel):
    beds: BedResources
    staff: StaffResources


class AlertItem(BaseModel):
    id: str
    severity: str
    type: str
    message: str


class RecommendationItem(BaseModel):
    title: str
    reason: str
    evidence: Dict[str, Any]


class RecommendationsResponse(BaseModel):
    recommendations: List[RecommendationItem]


class SimulationRequest(BaseModel):
    additional_doctors: int = Field(0, ge=0, le=20, description="Additional physicians deployed")
    additional_nurses: int = Field(0, ge=0, le=40, description="Additional RNs deployed")
    additional_beds: int = Field(0, ge=0, le=30, description="Additional overflow beds activated")
    arrival_increase_percent: float = Field(0.0, ge=-50.0, le=200.0, description="Simulated change in arrival volume (%)")


class SimulationResponse(BaseModel):
    baseline: Dict[str, float]
    scenario: Dict[str, float]
    change: Dict[str, float]
    assumptions: Dict[str, Any]
