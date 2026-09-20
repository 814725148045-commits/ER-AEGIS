export type RiskLevel = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface HospitalMetrics {
  timestamp: string; // ISO string
  displayTime: string; // e.g. "14:30"
  patientsArrived: number; // arrivals in the current hour
  arrivalBaseline: number; // normal baseline rate, e.g. 26/hr
  ambulanceArrivals: number;
  patientsWaiting: number;
  waitingCapacity: number; // e.g. 40
  patientsTreated: number;
  bedsTotal: number; // e.g. 70
  bedsOccupied: number; // e.g. 62
  bedsAvailable: number; // e.g. 8
  staffDoctors: number; // on duty
  staffDoctorsTotal: number; // scheduled
  staffNurses: number;
  staffNursesTotal: number;
  staffSupport: number;
  staffSupportTotal: number;
  ambulanceIncoming: number;
  ambulanceBaysAvailable: number;
  ambulanceBaysTotal: number;
  averageWaitTime: number; // in minutes
  averageTreatmentTime: number; // in minutes
  admissions: number;
  discharges: number;
  congestionRisk: number; // percentage 0-100
  congestionScore?: number; // composite 0-100
  bedOccupancyRate?: number; // 0.0 - 1.0
  staffCapacityScore?: number; // 0.0 - 1.0
  prevHourCongestionRisk: number;
  prevHourWaitTime: number;
}

export interface ForecastPoint {
  timestamp: string;
  timeLabel: string; // e.g. "-120m", "Now", "+30m", "+60m", "+90m", "+120m"
  isHistorical: boolean;
  congestionRisk: number; // 0-100%
  predictedWaitTime: number; // minutes
  predictedBedDemand: number; // beds needed
  confidence: number; // 0-100%
  upperBound: number;
  lowerBound: number;
}

export interface RiskFactor {
  id: string;
  name: string;
  changeValue: string; // e.g. "+24%"
  changeType: 'increase' | 'decrease';
  isSevere: boolean;
  description: string;
}

export interface EarlyWarningAlert {
  id: string;
  severity: RiskLevel;
  title: string;
  projectedPeak: string; // e.g. "94% in 75 minutes"
  primaryPressure: string; // e.g. "Patient arrivals + Bed availability"
  preparationWindow: string; // e.g. "20–30 minutes"
  timestamp: string;
}

export interface OperationalBottleneck {
  name: string;
  category: 'BEDS' | 'STAFF' | 'TRIAGE' | 'EMS';
  description: string;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number; // e.g. 89%
  secondaryFactor: string;
  projectedResolutionTime: string;
}

export interface Recommendation {
  id: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  reason: string;
  evidence?: Record<string, string | number | boolean>;
  expectedImpact: string;
  actionType: 'OPEN_BEDS' | 'REALLOCATE_NURSES' | 'PREPARE_OVERFLOW' | 'FAST_TRACK_DISCHARGE' | 'EMS_DIVERSION';
  status: 'PENDING' | 'APPLIED' | 'DISMISSED';
  impactPercentage: number; // e.g. 8
  appliedAt?: string;
}

export interface WhatIfParameters {
  additionalBeds: number; // 0-20
  additionalNurses: number; // 0-10
  additionalDoctors: number; // 0-5
  arrivalSurge: number; // -20 to +100 (%)
  treatmentCapacity: number; // -20 to +30 (%)
}

export interface WhatIfSimulationResult {
  baseline: {
    congestionRisk: number;
    waitTime: number;
    bedOccupancyRate: number;
    staffRatio: number;
  };
  simulated: {
    congestionRisk: number;
    waitTime: number;
    bedOccupancyRate: number;
    staffRatio: number;
  };
  deltas: {
    congestionDelta: number;
    waitTimeDelta: number;
    bedOccupancyDelta: number;
  };
  impactSummary: string;
  recommendationNote?: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: string[];
  intent?: string;
}
