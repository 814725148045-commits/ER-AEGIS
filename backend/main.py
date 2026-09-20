"""
================================================================================
ER-AEGIS: AI Emergency Response & Resource Intelligence System
FastAPI Backend Application (v1.0)
================================================================================
"""

import os
import sys
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure root directory is on Python path so backend and ml packages resolve
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.schemas.prediction import (
    HealthResponse,
    PredictionRequest,
    PredictionResponse,
    DashboardResponse,
    HistoryRecord,
    ForecastResponse,
    ResourcesResponse,
    AlertItem,
    RecommendationsResponse,
    SimulationRequest,
    SimulationResponse,
)
from backend.services.prediction_service import get_prediction_service
from backend.services.dashboard_service import get_dashboard_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Eagerly load model and hospital telemetry dataset once on startup
    print("[ER-AEGIS FastAPI] Initializing services...")
    try:
        pred_svc = get_prediction_service()
        dash_svc = get_dashboard_service()
        print(f"[ER-AEGIS FastAPI] Services online. Model ready: {pred_svc.is_loaded()}")
    except Exception as e:
        print(f"[ER-AEGIS FastAPI] Warning during startup initialization: {e}")
    yield
    print("[ER-AEGIS FastAPI] Shutting down.")


app = FastAPI(
    title="ER-AEGIS Operational Intelligence API",
    description="Real-time emergency department congestion forecasting and operational decision support.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
# Allows local Vite dev server, local standard dev server, and configurable environment origins
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Optional environment-based allowed origin
custom_origin = os.environ.get("ALLOWED_ORIGINS")
if custom_origin:
    allowed_origins.extend([o.strip() for o in custom_origin.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*",  # Supports container and preview origins safely
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Mask internal traceback to avoid leaking system internals
    error_msg = str(exc)
    print(f"[ER-AEGIS Error] Exception processing {request.method} {request.url.path}: {error_msg}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal operational error", "message": "Failed to process request"},
    )


# 1. Health check endpoint
@app.get("/api/health", response_model=HealthResponse, tags=["System"])
def health_check():
    try:
        pred_svc = get_prediction_service()
        is_loaded = pred_svc.is_loaded()
    except Exception:
        is_loaded = False

    return HealthResponse(
        status="ok",
        service="ER-AEGIS API",
        model_loaded=is_loaded,
    )


# 2. Prediction endpoint using trained ML Random Forest model
@app.post("/api/predict", response_model=PredictionResponse, tags=["Machine Learning"])
def predict_congestion(req: PredictionRequest):
    try:
        pred_svc = get_prediction_service()
        payload = req.model_dump()
        result = pred_svc.predict(payload)
        return PredictionResponse(**result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Model artifact error: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Prediction failed: {e}")


# 3. Current Dashboard snapshot endpoint
@app.get("/api/dashboard", response_model=DashboardResponse, tags=["Dashboard"])
def get_dashboard():
    try:
        dash_svc = get_dashboard_service()
        data = dash_svc.get_dashboard_data()
        return DashboardResponse(**data)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Dashboard snapshot failure: {e}")


# 4. History endpoint for trends and charts
@app.get("/api/history", response_model=list[HistoryRecord], tags=["Dashboard"])
def get_history(limit: int = Query(96, ge=1, le=1344, description="Number of historical 15-minute intervals")):
    try:
        dash_svc = get_dashboard_service()
        history = dash_svc.get_history(limit=limit)
        return [HistoryRecord(**h) for h in history]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"History retrieval failure: {e}")


# 5. Forecast endpoint (60-minute horizon)
@app.get("/api/forecast", response_model=ForecastResponse, tags=["Machine Learning"])
def get_forecast():
    try:
        dash_svc = get_dashboard_service()
        data = dash_svc.get_forecast()
        return ForecastResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Forecast failure: {e}")


# 6. Resources endpoint (beds and staff)
@app.get("/api/resources", response_model=ResourcesResponse, tags=["Resources"])
def get_resources():
    try:
        dash_svc = get_dashboard_service()
        data = dash_svc.get_resources()
        return ResourcesResponse(**data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Resource retrieval failure: {e}")


# 7. Operational Alerts endpoint
@app.get("/api/alerts", response_model=list[AlertItem], tags=["Alerts"])
def get_alerts():
    try:
        dash_svc = get_dashboard_service()
        alerts = dash_svc.get_alerts()
        return [AlertItem(**a) for a in alerts]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Alert generation failure: {e}")


# 8. Operational Recommendations endpoint
@app.get("/api/recommendations", response_model=RecommendationsResponse, tags=["Recommendations"])
def get_recommendations():
    try:
        dash_svc = get_dashboard_service()
        recs = dash_svc.get_recommendations()
        return RecommendationsResponse(**recs)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Recommendations failure: {e}")


# 9. What-If Scenario Simulation endpoint
@app.post("/api/simulation", response_model=SimulationResponse, tags=["Simulation"])
def run_simulation(req: SimulationRequest):
    try:
        dash_svc = get_dashboard_service()
        sim_result = dash_svc.run_simulation(
            additional_doctors=req.additional_doctors,
            additional_nurses=req.additional_nurses,
            additional_beds=req.additional_beds,
            arrival_increase_percent=req.arrival_increase_percent,
        )
        return SimulationResponse(**sim_result)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Simulation failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
