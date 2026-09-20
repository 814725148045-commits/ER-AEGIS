import { SyntheticHospitalRecord, PredictionInput } from './types';

/**
 * Feature Engineering for ER-AEGIS Congestion Prediction Models
 * 
 * Maps raw operational telemetry into standardized numerical feature vectors
 * for decision tree ensembles, including rolling rate trends and clinical staffing ratios.
 */

export const FEATURE_NAMES = [
  'patientsArrived',
  'ambulanceArrivals',
  'patientsWaiting',
  'bedsAvailable',
  'bedsOccupied',
  'doctorsAvailable',
  'nursesAvailable',
  'averageWaitTime',
  'averageTreatmentTime',
  'admissions',
  'discharges',
  'recentArrivalTrend',
  'recentCongestionTrend',
  'bedUtilization',
  'staffToPatientRatio',
  'netInpatientBedFlow',
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];

export interface FeatureExtractionResult {
  features: number[];
  featureMap: Record<FeatureName, number>;
}

/**
 * Extracts a structured feature vector from a live PredictionInput or HospitalMetrics
 */
export function extractFeaturesFromInput(input: PredictionInput): FeatureExtractionResult {
  const bedsTotal = input.bedsTotal ?? 70;
  const bedsOccupied = input.bedsOccupied;
  const bedsAvailable = input.bedsAvailable;
  const patientsWaiting = input.patientsWaiting;
  const doctorsAvailable = input.doctorsAvailable;
  const nursesAvailable = input.nursesAvailable;
  const admissions = input.admissions;
  const discharges = input.discharges;

  // Arrival trend: ratio of current arrivals to nominal baseline (default 1.0 if not provided)
  const recentArrivalTrend = input.recentArrivalTrend ?? (input.patientsArrived / 26);
  
  // Congestion trend (ratio vs previous hour baseline, default 1.0)
  const recentCongestionTrend = input.recentCongestionTrend ?? 1.0;

  // Derived operational ratios
  const bedUtilization = bedsTotal > 0 ? bedsOccupied / bedsTotal : 0.85;
  const totalActivePatients = Math.max(1, patientsWaiting + bedsOccupied);
  const totalClinicians = doctorsAvailable + nursesAvailable;
  const staffToPatientRatio = totalClinicians / totalActivePatients;
  const netInpatientBedFlow = admissions - discharges;

  const featureMap: Record<FeatureName, number> = {
    patientsArrived: input.patientsArrived,
    ambulanceArrivals: input.ambulanceArrivals,
    patientsWaiting,
    bedsAvailable,
    bedsOccupied,
    doctorsAvailable,
    nursesAvailable,
    averageWaitTime: input.averageWaitTime,
    averageTreatmentTime: input.averageTreatmentTime,
    admissions,
    discharges,
    recentArrivalTrend: Math.round(recentArrivalTrend * 100) / 100,
    recentCongestionTrend: Math.round(recentCongestionTrend * 100) / 100,
    bedUtilization: Math.round(bedUtilization * 100) / 100,
    staffToPatientRatio: Math.round(staffToPatientRatio * 100) / 100,
    netInpatientBedFlow,
  };

  const features = FEATURE_NAMES.map((name) => featureMap[name]);

  return { features, featureMap };
}

/**
 * Extracts training dataset matrix (X) and multi-target vectors (y) from synthetic records
 */
export function extractTrainingDataset(records: SyntheticHospitalRecord[]): {
  X: number[][];
  yBinary: number[]; // highCongestionNext60Min
  yContinuous30: number[];
  yContinuous60: number[];
  yContinuous90: number[];
  yContinuous120: number[];
} {
  const X: number[][] = [];
  const yBinary: number[] = [];
  const yContinuous30: number[] = [];
  const yContinuous60: number[] = [];
  const yContinuous90: number[] = [];
  const yContinuous120: number[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    // Compute rolling 4-quarter (1-hr) arrival average for trend calculation
    let pastArrivalsSum = 0;
    let pastArrivalsCount = 0;
    let pastCongestionSum = 0;
    for (let k = Math.max(0, i - 4); k < i; k++) {
      pastArrivalsSum += records[k].patientsArrived;
      pastCongestionSum += records[k].congestionScore;
      pastArrivalsCount++;
    }

    const avgPastArrivals = pastArrivalsCount > 0 ? (pastArrivalsSum / pastArrivalsCount) : (r.arrivalBaseline / 4);
    const avgPastCongestion = pastArrivalsCount > 0 ? (pastCongestionSum / pastArrivalsCount) : r.congestionScore;

    const arrivalTrend = avgPastArrivals > 0 ? (r.patientsArrived / avgPastArrivals) : 1.0;
    const congestionTrend = avgPastCongestion > 0 ? (r.congestionScore / avgPastCongestion) : 1.0;

    const { features } = extractFeaturesFromInput({
      patientsArrived: r.patientsArrived,
      ambulanceArrivals: r.ambulanceArrivals,
      patientsWaiting: r.patientsWaiting,
      bedsAvailable: r.bedsAvailable,
      bedsOccupied: r.bedsOccupied,
      bedsTotal: r.bedsTotal,
      doctorsAvailable: r.doctorsAvailable,
      nursesAvailable: r.nursesAvailable,
      supportStaffAvailable: r.supportStaffAvailable,
      averageWaitTime: r.averageWaitTime,
      averageTreatmentTime: r.averageTreatmentTime,
      admissions: r.admissions,
      discharges: r.discharges,
      recentArrivalTrend: arrivalTrend,
      recentCongestionTrend: congestionTrend,
    });

    X.push(features);
    yBinary.push(r.highCongestionNext60Min);
    yContinuous30.push(r.congestionNext30Min);
    yContinuous60.push(r.congestionNext60Min);
    yContinuous90.push(r.congestionNext90Min);
    yContinuous120.push(r.congestionNext120Min);
  }

  return {
    X,
    yBinary,
    yContinuous30,
    yContinuous60,
    yContinuous90,
    yContinuous120,
  };
}
