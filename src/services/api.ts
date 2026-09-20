/**
 * ER-AEGIS Frontend API Client Service
 * Connects to the FastAPI backend (http://localhost:8000)
 */

export interface ApiHealthResponse {
  status: string;
  service: string;
  backend?: string;
  model_loaded?: boolean;
  prediction_service?: string;
  dataset_available?: boolean;
  records_count?: number;
  mode?: string;
}

export interface ApiPredictionRequest {
  patients_arrived: number;
  ambulance_arrivals: number;
  patients_waiting: number;
  patients_treated: number;
  beds_occupied: number;
  beds_available: number;
  doctors_available: number;
  nurses_available: number;
  support_staff_available: number;
  average_wait_time: number;
  average_treatment_time: number;
  admissions: number;
  discharges: number;
  arrival_rate_per_hour: number;
  treatment_rate_per_hour: number;
  bed_occupancy_rate: number;
  staff_capacity_score: number;
  congestion_score: number;
}

export interface PredictionResponse {
  congestion_probability: number;
  predicted_congestion: boolean;
  predicted_congestion_level?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  horizon_minutes?: number;
  prediction_horizon_minutes: number;
  model_name?: string;
  generated_at?: string;
}
export type ApiPredictionResponse = PredictionResponse;

export interface DashboardResponse {
  timestamp: string;
  patients_waiting: number;
  patients_arrived: number;
  patients_treated: number;
  beds_total: number;
  beds_occupied: number;
  beds_available: number;
  doctors_available: number;
  nurses_available: number;
  support_staff_available: number;
  average_wait_time: number;
  average_treatment_time: number;
  congestion_score: number;
  bed_occupancy_rate: number;
  staff_capacity_score: number;
  prediction: PredictionResponse;
}
export type ApiDashboardResponse = DashboardResponse;

export interface HistoryRecord {
  timestamp: string;
  patients_arrived: number;
  patients_waiting: number;
  patients_treated: number;
  beds_occupied: number;
  beds_available: number;
  average_wait_time: number;
  congestion_score: number;
  bed_occupancy_rate: number;
}
export type ApiHistoryRecord = HistoryRecord;

export interface ForecastResponse {
  horizon_minutes: number;
  congestion_probability: number;
  predicted_congestion_level?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  model_name?: string;
  generated_at?: string;
  notice?: string;
}
export type ApiForecastResponse = ForecastResponse;

export interface BedResources {
  total: number;
  occupied: number;
  available: number;
}

export interface StaffResources {
  doctors: number;
  nurses: number;
  support_staff: number;
}

export interface ResourcesResponse {
  beds: BedResources;
  staff: StaffResources;
}
export type ApiResourcesResponse = ResourcesResponse;

export interface AlertItem {
  id: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  type: string;
  message: string;
}
export type ApiAlertItem = AlertItem;

export interface RecommendationItem {
  title: string;
  reason: string;
  evidence: Record<string, string | number | boolean>;
}
export type ApiRecommendationItem = RecommendationItem;

export interface RecommendationsResponse {
  recommendations: RecommendationItem[];
}
export type ApiRecommendationsResponse = RecommendationsResponse;

export interface SimulationRequest {
  additional_doctors?: number;
  additional_nurses?: number;
  additional_beds?: number;
  arrival_increase_percent?: number;
}
export type ApiSimulationRequest = SimulationRequest;

export interface SimulationResponse {
  baseline: {
    congestion_probability: number;
  };
  scenario: {
    congestion_probability: number;
  };
  change: {
    probability_difference: number;
  };
  assumptions?: Record<string, string | number | boolean>;
}
export type ApiSimulationResponse = SimulationResponse;

// Configured API base URL: defaults to empty string so requests hit the ER-AEGIS application server directly,
// or uses VITE_API_URL if an external backend is explicitly configured.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
  
  try {
    const res = await fetch(primaryUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // If external API_BASE_URL failed, try relative route to application server
    if (API_BASE_URL && !endpoint.startsWith('http')) {
      try {
        const fallbackRes = await fetch(endpoint, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
          },
        });
        if (fallbackRes.ok) {
          return await fallbackRes.json();
        }
      } catch {}
    }
    throw new Error(`ER-AEGIS backend unavailable: ${err instanceof Error ? err.message : 'Connection refused'}`);
  }

  // If primary returned non-ok and was external, try fallback
  if (API_BASE_URL && !endpoint.startsWith('http')) {
    try {
      const fallbackRes = await fetch(endpoint, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {}),
        },
      });
      if (fallbackRes.ok) {
        return await fallbackRes.json();
      }
    } catch {}
  }

  throw new Error(`ER-AEGIS backend unavailable: Connection refused or server error`);
}

export const erAegisApi = {
  /**
   * Health check to confirm API, dataset, and ML model availability
   * Probes GET /health with fallback to GET /api/health
   */
  async checkHealth(): Promise<ApiHealthResponse> {
    try {
      return await apiFetch<ApiHealthResponse>('/health');
    } catch {
      return await apiFetch<ApiHealthResponse>('/api/health');
    }
  },

  /**
   * Fetch current hospital operational snapshot + live ML 60-min prediction
   */
  async getDashboard(): Promise<ApiDashboardResponse> {
    return apiFetch<ApiDashboardResponse>('/api/dashboard');
  },

  /**
   * Fetch historical 15-minute operational records for trend analysis
   */
  async getHistory(limit: number = 96): Promise<ApiHistoryRecord[]> {
    return apiFetch<ApiHistoryRecord[]>(`/api/history?limit=${limit}`);
  },

  /**
   * Fetch latest 60-minute ML model forecast
   */
  async getForecast(): Promise<ApiForecastResponse> {
    return apiFetch<ApiForecastResponse>('/api/forecast');
  },

  /**
   * Fetch current bed and staff allocations
   */
  async getResources(): Promise<ApiResourcesResponse> {
    return apiFetch<ApiResourcesResponse>('/api/resources');
  },

  /**
   * Fetch real-time rule and model-driven operational alerts
   */
  async getAlerts(): Promise<ApiAlertItem[]> {
    return apiFetch<ApiAlertItem[]>('/api/alerts');
  },

  /**
   * Fetch data-grounded operational recommendations with supporting evidence
   */
  async getRecommendations(): Promise<ApiRecommendationsResponse> {
    return apiFetch<ApiRecommendationsResponse>('/api/recommendations');
  },

  /**
   * Submit arbitrary operational state to trained Random Forest model
   */
  async predictCongestion(data: ApiPredictionRequest): Promise<ApiPredictionResponse> {
    return apiFetch<ApiPredictionResponse>('/api/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Run What-If scenario through trained ML model
   */
  async runSimulation(req: ApiSimulationRequest): Promise<ApiSimulationResponse> {
    return apiFetch<ApiSimulationResponse>('/api/simulation', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },
};
