/**
 * Types and interfaces for the ER-AEGIS Machine Learning & Synthetic Intelligence Layer
 */

export interface SyntheticHospitalRecord {
  timestamp: string; // ISO 8601 timestamp
  timeIndex: number; // 0..N step index
  dayOfWeek: number; // 0 = Sun, 1 = Mon ... 6 = Sat
  hourOfDay: number; // 0..23
  minuteOfHour: number; // 0, 15, 30, 45

  // 15-minute operational rates & telemetry
  patientsArrived: number; // arrivals in this 15-min interval
  arrivalBaseline: number; // expected nominal arrival rate
  ambulanceArrivals: number; // EMS offloads in this interval
  patientsWaiting: number; // current queue in waiting room
  patientsTreated: number; // patients discharged/transferred out of treatment in interval
  treatmentCapacity: number; // maximum clinical throughput based on staff
  
  // Bed capacity & inpatient flows
  bedsTotal: number; // total licensed acute beds (e.g. 70)
  bedsOccupied: number; // beds currently holding patients
  bedsAvailable: number; // vacant acute beds
  admissions: number; // ED patients admitted to inpatient beds in interval
  discharges: number; // inpatient discharges freeing acute beds in interval

  // Clinical staffing
  doctorsAvailable: number;
  nursesAvailable: number;
  supportStaffAvailable: number;

  // Operational delay telemetry
  averageWaitTime: number; // minutes from arrival to clinician assessment
  averageTreatmentTime: number; // minutes in acute treatment bay

  // Contextual flags
  isSurgeEvent: boolean;
  isRecoveryPeriod: boolean;

  // Real-time computed congestion score (0 to 100)
  congestionScore: number;

  // Supervised ML targets
  // Derived target: whether the ED enters a high-congestion state within the next 60 min (4 steps ahead)
  highCongestionNext60Min: number; // 1 = True (High Congestion), 0 = False

  // Multi-horizon continuous congestion targets (0 to 100)
  congestionNext30Min: number; // t + 2 steps
  congestionNext60Min: number; // t + 4 steps
  congestionNext90Min: number; // t + 6 steps
  congestionNext120Min: number; // t + 8 steps
}

export interface MLFeatureVector {
  // Operational features
  patientsArrived: number;
  ambulanceArrivals: number;
  patientsWaiting: number;
  bedsAvailable: number;
  bedsOccupied: number;
  doctorsAvailable: number;
  nursesAvailable: number;
  averageWaitTime: number;
  averageTreatmentTime: number;
  admissions: number;
  discharges: number;
  
  // Trend features
  recentArrivalTrend: number; // Ratio of current arrivals to 1-hr rolling average
  recentCongestionTrend: number; // Ratio of current congestion to 1-hr rolling average

  // Derived operational ratios
  bedUtilization: number; // bedsOccupied / bedsTotal (0.0 to 1.0)
  waitingToCapacityRatio: number; // patientsWaiting / waitingCapacity (0.0 to 1.0+)
  staffToPatientRatio: number; // active staff / total active patients
  netInpatientBedFlow: number; // admissions - discharges
}

export interface PredictionInput {
  patientsArrived: number;
  ambulanceArrivals: number;
  patientsWaiting: number;
  bedsAvailable: number;
  bedsOccupied: number;
  bedsTotal?: number;
  doctorsAvailable: number;
  nursesAvailable: number;
  supportStaffAvailable?: number;
  averageWaitTime: number;
  averageTreatmentTime: number;
  admissions: number;
  discharges: number;
  recentArrivalTrend?: number;
  recentCongestionTrend?: number;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  importance: number; // 0.0 to 1.0
  percentage: number; // 0 to 100
  impactDirection: 'Increases Risk' | 'Mitigates Risk';
  description: string;
}

export interface PredictionOutput {
  congestionProbability: number; // e.g. 0.87 (probability of high congestion in next 60 min)
  predictedCongestionLevel: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  forecast: {
    '30': number; // e.g. 0.71 (or percentage 71%)
    '60': number; // e.g. 0.79
    '90': number; // e.g. 0.84
    '120': number; // e.g. 0.81
  };
  forecastPercentages: {
    '30': number; // 71
    '60': number; // 79
    '90': number; // 84
    '120': number; // 81
  };
  confidence: number; // 0.0 to 1.0 (or 0-100%)
  featureImportance: FeatureImportanceItem[];
  modelMetadata: {
    algorithm: string;
    ensembleSize: number;
    trainingSamples: number;
    trainingHorizon: string;
    targetDefinition: string;
    validationAccuracy: number;
    apiReady: boolean;
    pythonFastApiSpec: string;
    lastTrainedAt: string;
  };
}

export interface DatasetSummary {
  totalRecords: number;
  intervalMinutes: number;
  totalDays: number;
  startDate: string;
  endDate: string;
  highCongestionRatePercent: number;
  surgeEventsCount: number;
  recoveryPeriodsCount: number;
  metricsSummary: {
    avgArrivalsPerInterval: number;
    avgAmbulancePerInterval: number;
    avgPatientsWaiting: number;
    avgBedsOccupied: number;
    avgBedsAvailable: number;
    avgWaitTimeMinutes: number;
    avgCongestionScore: number;
  };
  targetDefinitionDocumentation: {
    targetName: string;
    horizon: string;
    formula: string;
    thresholdConditions: string[];
    clinicalDisclaimer: string;
  };
}
