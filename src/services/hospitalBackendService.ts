import fs from 'fs';
import path from 'path';
import { mlPredictionService } from '../ml/mlPredictionService.ts';

export interface HospitalDataRow {
  timestamp: string;
  patients_arrived: number;
  ambulance_arrivals: number;
  patients_waiting: number;
  patients_treated: number;
  beds_total: number;
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
  high_congestion_next_60min: number;
}

export interface PredictionResult {
  congestion_probability: number;
  predicted_congestion: boolean;
  predicted_congestion_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  horizon_minutes: number;
  prediction_horizon_minutes: number;
  model_name: string;
  generated_at?: string | null;
}

export interface DashboardResult {
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
  prediction: PredictionResult;
}

export interface HistoryResult {
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

export interface AlertResult {
  id: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  type: string;
  message: string;
}

export interface RecommendationResult {
  title: string;
  reason: string;
  evidence: Record<string, string | number | boolean>;
}

export interface SimulationResult {
  baseline: {
    congestion_probability: number;
  };
  scenario: {
    congestion_probability: number;
  };
  change: {
    probability_difference: number;
  };
  assumptions: Record<string, string | number | boolean>;
}

function determineRiskLevel(prob: number): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (prob < 0.40) return 'LOW';
  if (prob < 0.65) return 'MODERATE';
  if (prob < 0.85) return 'HIGH';
  return 'CRITICAL';
}

class HospitalBackendService {
  private rows: HospitalDataRow[] = [];
  private dataPath: string;
  private isLoaded = false;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'hospital_data.csv');
    this.loadData();
  }

  private loadData(): void {
    try {
      if (!fs.existsSync(this.dataPath)) {
        console.warn(`[ER-AEGIS Backend] CSV dataset missing at ${this.dataPath}`);
        return;
      }

      const fileContent = fs.readFileSync(this.dataPath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      if (lines.length <= 1) return;

      const header = lines[0].split(',').map((h) => h.trim());
      const parsedRows: HospitalDataRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(',');

        const row: any = {};
        for (let j = 0; j < header.length; j++) {
          const colName = header[j];
          const val = vals[j];
          if (colName === 'timestamp') {
            row[colName] = val;
          } else {
            row[colName] = parseFloat(val) || 0;
          }
        }
        parsedRows.push(row as HospitalDataRow);
      }

      this.rows = parsedRows;
      this.isLoaded = true;
      console.log(`[ER-AEGIS Backend] Successfully loaded ${this.rows.length} records from hospital_data.csv.`);
    } catch (err) {
      console.error('[ER-AEGIS Backend] Error loading hospital_data.csv:', err);
    }
  }

  public isDatasetAvailable(): boolean {
    return this.isLoaded && this.rows.length > 0;
  }

  public getRecordCount(): number {
    return this.rows.length;
  }

  public getLatestRow(): HospitalDataRow {
    if (!this.rows.length) {
      this.loadData();
    }
    if (!this.rows.length) {
      throw new Error('Hospital dataset is empty or unavailable');
    }
    return this.rows[this.rows.length - 1];
  }

  public predict(input: Partial<HospitalDataRow> & Record<string, any>): PredictionResult {
    const patientsArrived = Number(input.patients_arrived ?? input.patientsArrived ?? 1);
    const ambulanceArrivals = Number(input.ambulance_arrivals ?? input.ambulanceArrivals ?? 0);
    const patientsWaiting = Number(input.patients_waiting ?? input.patientsWaiting ?? 12);
    const bedsAvailable = Number(input.beds_available ?? input.bedsAvailable ?? 13);
    const bedsOccupied = Number(input.beds_occupied ?? input.bedsOccupied ?? 57);
    const bedsTotal = Number(input.beds_total ?? input.bedsTotal ?? 70);
    const doctorsAvailable = Number(input.doctors_available ?? input.doctorsAvailable ?? 8);
    const nursesAvailable = Number(input.nurses_available ?? input.nursesAvailable ?? 17);
    const supportStaffAvailable = Number(input.support_staff_available ?? input.supportStaffAvailable ?? 6);
    const averageWaitTime = Number(input.average_wait_time ?? input.averageWaitTime ?? 67);
    const averageTreatmentTime = Number(input.average_treatment_time ?? input.averageTreatmentTime ?? 42.3);
    const admissions = Number(input.admissions ?? 2);
    const discharges = Number(input.discharges ?? 2);

    const mlOutput = mlPredictionService.predictCongestion({
      patientsArrived,
      ambulanceArrivals,
      patientsWaiting,
      bedsAvailable,
      bedsOccupied,
      bedsTotal,
      doctorsAvailable,
      nursesAvailable,
      supportStaffAvailable,
      averageWaitTime,
      averageTreatmentTime,
      admissions,
      discharges,
      recentArrivalTrend: input.recentArrivalTrend,
      recentCongestionTrend: input.recentCongestionTrend,
    });

    const prob = Math.round(mlOutput.congestionProbability * 10000) / 10000;
    const risk = determineRiskLevel(prob);

    return {
      congestion_probability: prob,
      predicted_congestion: prob >= 0.50,
      predicted_congestion_level: risk,
      risk_level: risk,
      horizon_minutes: 60,
      prediction_horizon_minutes: 60,
      model_name: 'RandomForestClassifier (28 features, 60-min horizon)',
      generated_at: input.timestamp ? String(input.timestamp) : new Date().toISOString(),
    };
  }

  public getDashboardData(): DashboardResult {
    const row = this.getLatestRow();
    const prediction = this.predict(row);

    return {
      timestamp: row.timestamp,
      patients_waiting: row.patients_waiting,
      patients_arrived: row.patients_arrived,
      patients_treated: row.patients_treated,
      beds_total: row.beds_total,
      beds_occupied: row.beds_occupied,
      beds_available: row.beds_available,
      doctors_available: row.doctors_available,
      nurses_available: row.nurses_available,
      support_staff_available: row.support_staff_available,
      average_wait_time: Math.round(row.average_wait_time * 10) / 10,
      average_treatment_time: Math.round(row.average_treatment_time * 10) / 10,
      congestion_score: Math.round(row.congestion_score * 10) / 10,
      bed_occupancy_rate: Math.round(row.bed_occupancy_rate * 10000) / 10000,
      staff_capacity_score: Math.round(row.staff_capacity_score * 10000) / 10000,
      prediction,
    };
  }

  public getHistory(limit = 96): HistoryResult[] {
    if (!this.rows.length) this.loadData();
    const sliceCount = Math.max(1, Math.min(limit, this.rows.length));
    const sub = this.rows.slice(this.rows.length - sliceCount);

    return sub.map((r) => ({
      timestamp: r.timestamp,
      patients_arrived: r.patients_arrived,
      patients_waiting: r.patients_waiting,
      patients_treated: r.patients_treated,
      beds_occupied: r.beds_occupied,
      beds_available: r.beds_available,
      average_wait_time: Math.round(r.average_wait_time * 10) / 10,
      congestion_score: Math.round(r.congestion_score * 10) / 10,
      bed_occupancy_rate: Math.round(r.bed_occupancy_rate * 10000) / 10000,
    }));
  }

  public getForecast(): Record<string, any> {
    const row = this.getLatestRow();
    const pred = this.predict(row);

    return {
      horizon_minutes: 60,
      congestion_probability: pred.congestion_probability,
      predicted_congestion_level: pred.predicted_congestion_level,
      risk_level: pred.risk_level,
      model_name: pred.model_name,
      generated_at: pred.generated_at,
      notice: 'ER-AEGIS model is trained specifically for 60-minute prediction horizon',
    };
  }

  public getResources(): Record<string, any> {
    const row = this.getLatestRow();
    return {
      beds: {
        total: row.beds_total,
        occupied: row.beds_occupied,
        available: row.beds_available,
      },
      staff: {
        doctors: row.doctors_available,
        nurses: row.nurses_available,
        support_staff: row.support_staff_available,
      },
    };
  }

  public getAlerts(): AlertResult[] {
    const row = this.getLatestRow();
    const pred = this.predict(row);
    const alerts: AlertResult[] = [];

    // 1. Congestion Risk Alert
    if (pred.risk_level === 'HIGH' || pred.risk_level === 'CRITICAL') {
      alerts.push({
        id: 'congestion-risk',
        severity: pred.risk_level,
        type: 'HIGH_CONGESTION_RISK',
        message: `AI model predicts elevated congestion risk (${(pred.congestion_probability * 100).toFixed(1)}%) within 60 minutes.`,
      });
    } else if (pred.risk_level === 'MODERATE') {
      alerts.push({
        id: 'congestion-risk',
        severity: 'MODERATE',
        type: 'MODERATE_CONGESTION_RISK',
        message: `AI model indicates moderate congestion risk (${(pred.congestion_probability * 100).toFixed(1)}%) developing.`,
      });
    }

    // 2. Bed Availability Alert
    const bedsAvail = row.beds_available;
    const bedOcc = row.bed_occupancy_rate;
    if (bedsAvail <= 6) {
      alerts.push({
        id: 'low-bed-availability',
        severity: bedsAvail <= 3 ? 'CRITICAL' : 'HIGH',
        type: 'LOW_BED_AVAILABILITY',
        message: `Acute bed availability critical: only ${bedsAvail} beds remaining (${(bedOcc * 100).toFixed(1)}% capacity).`,
      });
    } else if (bedsAvail <= 12 || bedOcc >= 0.82) {
      alerts.push({
        id: 'low-bed-availability',
        severity: 'MODERATE',
        type: 'LOW_BED_AVAILABILITY',
        message: `Bed reserve tightening: ${bedsAvail} beds open (${(bedOcc * 100).toFixed(1)}% occupied).`,
      });
    }

    // 3. Wait Time Alert
    const avgWait = row.average_wait_time;
    if (avgWait >= 55.0) {
      alerts.push({
        id: 'high-wait-time',
        severity: 'HIGH',
        type: 'HIGH_WAIT_TIME',
        message: `Average door-to-doctor wait time escalated to ${Math.round(avgWait)} minutes.`,
      });
    } else if (avgWait >= 40.0) {
      alerts.push({
        id: 'high-wait-time',
        severity: 'MODERATE',
        type: 'HIGH_WAIT_TIME',
        message: `Average wait time elevated at ${Math.round(avgWait)} minutes.`,
      });
    }

    // 4. Staff Pressure Alert
    const staffCap = row.staff_capacity_score;
    if (staffCap <= 0.45) {
      alerts.push({
        id: 'staff-pressure',
        severity: 'HIGH',
        type: 'STAFF_PRESSURE',
        message: `Staff capacity score strained at ${staffCap.toFixed(2)} relative to triage volume.`,
      });
    } else if (staffCap <= 0.60) {
      alerts.push({
        id: 'staff-pressure',
        severity: 'MODERATE',
        type: 'STAFF_PRESSURE',
        message: `Clinical staffing utilization elevated (${staffCap.toFixed(2)} capacity ratio).`,
      });
    }

    return alerts;
  }

  public getRecommendations(): { recommendations: RecommendationResult[] } {
    const row = this.getLatestRow();
    const pred = this.predict(row);
    const recs: RecommendationResult[] = [];

    const bedsAvail = row.beds_available;
    const bedOcc = row.bed_occupancy_rate;
    const patientsWaiting = row.patients_waiting;
    const avgWait = row.average_wait_time;
    const staffCap = row.staff_capacity_score;

    if (bedsAvail <= 12 || bedOcc >= 0.80) {
      recs.push({
        title: 'Review bed turnover and prioritize discharge processing',
        reason: 'Acute bed occupancy is high, creating potential admission boarding delays.',
        evidence: {
          beds_available: bedsAvail,
          bed_occupancy_rate: Math.round(bedOcc * 1000) / 1000,
          congestion_probability: pred.congestion_probability,
        },
      });
    }

    if (patientsWaiting >= 15 || avgWait >= 35.0) {
      recs.push({
        title: 'Consider reallocating available operational staff toward high-throughput intake',
        reason: 'Waiting queue velocity is contributing to extended door-to-provider wait intervals.',
        evidence: {
          patients_waiting: patientsWaiting,
          average_wait_time: Math.round(avgWait * 10) / 10,
          nurses_available: row.nurses_available,
        },
      });
    }

    if (staffCap <= 0.65) {
      recs.push({
        title: 'Review current staffing allocation and prepare on-call reserves',
        reason: 'Provider-to-patient ratio indicates emerging triage and observation bottleneck.',
        evidence: {
          staff_capacity_score: Math.round(staffCap * 1000) / 1000,
          doctors_available: row.doctors_available,
          nurses_available: row.nurses_available,
        },
      });
    }

    if (pred.congestion_probability >= 0.65) {
      recs.push({
        title: 'Initiate pre-surge operational protocol with charge coordinator',
        reason: 'ML forecast indicates high probability of severe congestion within the 60-minute horizon.',
        evidence: {
          congestion_probability: pred.congestion_probability,
          risk_level: pred.risk_level,
          prediction_horizon_minutes: 60,
        },
      });
    }

    if (recs.length === 0) {
      recs.push({
        title: 'Maintain standard operational monitoring',
        reason: 'All ED operational metrics and ML forecasts currently indicate nominal capacity.',
        evidence: {
          congestion_probability: pred.congestion_probability,
          beds_available: bedsAvail,
          average_wait_time: avgWait,
        },
      });
    }

    return { recommendations: recs };
  }

  public runSimulation(params: {
    additional_doctors?: number;
    additional_nurses?: number;
    additional_beds?: number;
    arrival_increase_percent?: number;
  }): SimulationResult {
    const additional_doctors = Number(params.additional_doctors || 0);
    const additional_nurses = Number(params.additional_nurses || 0);
    const additional_beds = Number(params.additional_beds || 0);
    const arrival_increase_percent = Number(params.arrival_increase_percent || 0);

    const baseRow = this.getLatestRow();
    const basePred = this.predict(baseRow);

    const scenarioData: HospitalDataRow = { ...baseRow };

    // 1. Staffing intervention
    const newDocs = baseRow.doctors_available + additional_doctors;
    const newNurses = baseRow.nurses_available + additional_nurses;
    scenarioData.doctors_available = newDocs;
    scenarioData.nurses_available = newNurses;

    const baseStaffCap = baseRow.staff_capacity_score;
    const staffBoost = additional_doctors * 0.035 + additional_nurses * 0.02;
    scenarioData.staff_capacity_score = Math.min(1.0, baseStaffCap + staffBoost);

    // 2. Bed expansion intervention
    const newBedsTotal = baseRow.beds_total + additional_beds;
    scenarioData.beds_total = newBedsTotal;
    scenarioData.beds_available = baseRow.beds_available + additional_beds;
    scenarioData.bed_occupancy_rate = Math.min(1.0, Math.max(0.0, baseRow.beds_occupied / Math.max(1, newBedsTotal)));

    // 3. Patient arrival surge / reduction intervention
    const arrivalMult = 1.0 + arrival_increase_percent / 100.0;
    scenarioData.patients_arrived = Math.max(0, Math.round(baseRow.patients_arrived * arrivalMult));
    scenarioData.arrival_rate_per_hour = Math.max(0.0, baseRow.arrival_rate_per_hour * arrivalMult);

    if (arrival_increase_percent > 0) {
      scenarioData.patients_waiting = Math.round(baseRow.patients_waiting * (1.0 + arrival_increase_percent / 150.0));
      scenarioData.average_wait_time = baseRow.average_wait_time * (1.0 + arrival_increase_percent / 200.0);
    } else if (arrival_increase_percent < 0) {
      scenarioData.patients_waiting = Math.max(2, Math.round(baseRow.patients_waiting * (1.0 + arrival_increase_percent / 100.0)));
      scenarioData.average_wait_time = Math.max(10.0, baseRow.average_wait_time * (1.0 + arrival_increase_percent / 100.0));
    }

    if (additional_doctors > 0 || additional_nurses > 0) {
      scenarioData.treatment_rate_per_hour = baseRow.treatment_rate_per_hour * (1.0 + staffBoost * 0.5);
      scenarioData.average_wait_time = Math.max(10.0, scenarioData.average_wait_time * (1.0 - staffBoost * 0.3));
    }

    const scenarioPred = this.predict(scenarioData);

    const baseProb = basePred.congestion_probability;
    const scenProb = scenarioPred.congestion_probability;
    const diff = Math.round((scenProb - baseProb) * 10000) / 10000;

    return {
      baseline: {
        congestion_probability: baseProb,
      },
      scenario: {
        congestion_probability: scenProb,
      },
      change: {
        probability_difference: diff,
      },
      assumptions: {
        simulated_additional_doctors: additional_doctors,
        simulated_additional_nurses: additional_nurses,
        simulated_additional_beds: additional_beds,
        simulated_arrival_change_percent: arrival_increase_percent,
        disclaimer: 'Transparent prototype simulation mapping interventions to Random Forest operational input features.',
      },
    };
  }
}

export const hospitalBackendService = new HospitalBackendService();
