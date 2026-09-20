import { SyntheticHospitalRecord, DatasetSummary } from './types';

/**
 * ER-AEGIS Synthetic Hospital Operations Data Generator
 * 
 * Generates high-fidelity, causally coupled Emergency Department operations data
 * adhering to clinical queuing models, diurnal human arrival cycles, inpatient boarding
 * constraints, ambulance arrival bursts, and discrete surge/recovery phases.
 */

// Simple seeded pseudo-random generator for reproducible ML training
class SeededRandom {
  private seed: number;
  constructor(seed: number = 42) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  gaussian(mean: number = 0, stdev: number = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdev;
  }
}

/**
 * Exact target formula specification for highCongestionNext60Min:
 * 
 * Congestion Score C(t) = 
 *    0.35 * (bedsOccupied / bedsTotal * 100) +
 *    0.30 * min(100, (patientsWaiting / 35) * 100) +
 *    0.20 * min(100, (patientsArrivedInHour / 32) * 100) +
 *    0.15 * min(100, (averageWaitTime / 60) * 100)
 * 
 * High-Congestion State Condition:
 *   A state is HIGH if:
 *     1. C(t) >= 80.0, OR
 *     2. bedsAvailable <= 5 AND patientsWaiting >= 28, OR
 *     3. averageWaitTime >= 65 minutes
 * 
 * Target highCongestionNext60Min at time t:
 *   1 if any interval within [t+1, t+2, t+3, t+4] (the subsequent 60 minutes) enters HIGH state.
 *   0 otherwise.
 */
export function computeCongestionScore(
  bedsOccupied: number,
  bedsTotal: number,
  patientsWaiting: number,
  patientsArrivedQuarter: number,
  averageWaitTime: number
): number {
  const bedRatioScore = (bedsOccupied / Math.max(1, bedsTotal)) * 100;
  const queueRatioScore = Math.min(100, (patientsWaiting / 35) * 100);
  const arrivalRateScore = Math.min(100, (patientsArrivedQuarter * 4 / 32) * 100);
  const waitRatioScore = Math.min(100, (averageWaitTime / 60) * 100);

  const rawScore =
    0.35 * bedRatioScore +
    0.30 * queueRatioScore +
    0.20 * arrivalRateScore +
    0.15 * waitRatioScore;

  return Math.min(100, Math.max(0, Math.round(rawScore * 10) / 10));
}

export function isHighCongestionState(
  score: number,
  bedsAvailable: number,
  patientsWaiting: number,
  averageWaitTime: number
): boolean {
  if (score >= 80.0) return true;
  if (bedsAvailable <= 5 && patientsWaiting >= 28) return true;
  if (averageWaitTime >= 65) return true;
  return false;
}

export interface GeneratorOptions {
  days?: number; // default 7
  startDate?: Date;
  seed?: number;
}

/**
 * Generates realistic synthetic hospital data spanning N days with 15-minute observations.
 */
export function generateSyntheticHospitalData(
  options: GeneratorOptions = {}
): SyntheticHospitalRecord[] {
  const days = options.days ?? 7;
  const rng = new SeededRandom(options.seed ?? 1024);
  const baseDate = options.startDate ?? new Date(2026, 8, 12, 0, 0, 0); // 7 days prior

  const totalIntervals = days * 24 * 4; // 15-min intervals (672 for 7 days)
  // We generate 8 extra intervals (2 hours) at the end so the lookahead targets don't have truncation artifacts
  const bufferIntervals = 8;
  const generationCount = totalIntervals + bufferIntervals;

  const records: SyntheticHospitalRecord[] = [];

  // Hospital fixed capacity parameters
  const bedsTotal = 70;
  const waitingCapacity = 40;

  // Initial baseline state
  let currentBedsOccupied = 48;
  let currentWaitingQueue = 12;
  let currentWaitTime = 25;
  let currentTreatmentTime = 48;

  // Simulation loop for each 15-minute step
  for (let step = 0; step < generationCount; step++) {
    const timestamp = new Date(baseDate.getTime() + step * 15 * 60 * 1000);
    const dayOfWeek = timestamp.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const hourOfDay = timestamp.getHours();
    const minuteOfHour = timestamp.getMinutes();

    // 1. DIURNAL ARRIVAL PATTERN
    // Overnight (01:00-06:00): low demand
    // Morning (07:00-11:00): sharp increase
    // Afternoon (12:00-16:00): high sustained volume
    // Evening (17:00-21:00): peak community and trauma arrivals
    // Night (22:00-00:00): gradual reduction
    let diurnalArrivalFactor = 1.0;
    if (hourOfDay >= 1 && hourOfDay <= 5) {
      diurnalArrivalFactor = 0.38 + (hourOfDay / 20); // 0.43 to 0.63
    } else if (hourOfDay >= 6 && hourOfDay <= 10) {
      diurnalArrivalFactor = 0.75 + ((hourOfDay - 6) * 0.12); // 0.75 to 1.23
    } else if (hourOfDay >= 11 && hourOfDay <= 16) {
      diurnalArrivalFactor = 1.25 + rng.gaussian(0, 0.05); // ~1.25
    } else if (hourOfDay >= 17 && hourOfDay <= 21) {
      diurnalArrivalFactor = 1.42 + rng.gaussian(0, 0.08); // ~1.42 (Evening peak)
    } else {
      diurnalArrivalFactor = 0.85;
    }

    // Weekend factor (Saturdays and Sundays have higher acute trauma & lower outpatient clinics)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendMultiplier = isWeekend ? 1.15 : 1.0;

    // 2. SURGE & RECOVERY EVENT MODELING
    // Event 1: Major Regional Casualty Incident & Respiratory Epidemic Wave
    // Day 3 (Wednesday, hours 60 to 78 -> steps 240 to 312)
    const isSurge1 = step >= 252 && step <= 288; // 9 hours peak surge
    // Recovery 1: Day 4 (Thursday morning, steps 292 to 340)
    const isRecovery1 = step > 288 && step <= 336;

    // Event 2: Saturday Night Inpatient Ward Gridlock & Alcohol/Trauma Influx
    // Day 6 (Saturday evening, hours 140 to 156 -> steps 560 to 624)
    const isSurge2 = step >= 570 && step <= 616;

    let surgeMultiplier = 1.0;
    if (isSurge1) {
      surgeMultiplier = 1.65 + rng.gaussian(0, 0.1);
    } else if (isSurge2) {
      surgeMultiplier = 1.50 + rng.gaussian(0, 0.08);
    } else if (isRecovery1) {
      surgeMultiplier = 0.85; // slightly subdued community arrivals after major incident alert
    }

    // Nominal baseline arrival rate per 15 minutes (approx 6-7 per 15m, equals ~26 per hour)
    const baselineArrivalPerQuarter = 6.5;
    const expectedArrivals = baselineArrivalPerQuarter * diurnalArrivalFactor * weekendMultiplier * surgeMultiplier;
    const patientsArrived = Math.max(1, Math.round(expectedArrivals + rng.gaussian(0, 1.2)));

    // 3. AMBULANCE (EMS) ARRIVALS
    // Usually 15-22% of total arrivals, with random emergency clusters
    let emsArrivals = Math.max(0, Math.round(patientsArrived * 0.20 + rng.gaussian(0, 0.6)));
    // Occasional EMS burst (every ~18 intervals on average, or during surges)
    if (isSurge1 || (rng.next() < 0.05 && hourOfDay >= 10 && hourOfDay <= 22)) {
      emsArrivals += Math.round(2 + rng.next() * 3);
    }
    if (isSurge2 && hourOfDay >= 21) {
      emsArrivals += Math.round(2 + rng.next() * 2);
    }

    // 4. CLINICAL STAFFING SHIFTS
    // Day Shift (07:00 - 19:00): 12-15 doctors, 24-30 nurses
    // Night Shift (19:00 - 07:00): 8-10 doctors, 16-20 nurses
    const isDayShift = hourOfDay >= 7 && hourOfDay < 19;
    let baseDoctors = isDayShift ? 13 : 9;
    let baseNurses = isDayShift ? 26 : 18;
    let baseSupport = isDayShift ? 9 : 6;

    // Surge staffing protocol: hospital calls in extra float staff during known surge
    if (isSurge1 || isRecovery1) {
      baseDoctors += 2;
      baseNurses += 4;
      baseSupport += 2;
    }

    const doctorsAvailable = Math.max(6, Math.round(baseDoctors + rng.gaussian(0, 0.7)));
    const nursesAvailable = Math.max(12, Math.round(baseNurses + rng.gaussian(0, 1.2)));
    const supportStaffAvailable = Math.max(4, Math.round(baseSupport + rng.gaussian(0, 0.5)));

    // 5. TREATMENT CAPACITY & PATIENTS TREATED
    // Doctors and nurses jointly determine clinical throughput per 15 minutes
    // Clinician capacity per quarter: roughly 0.45 pts/doctor/15m, 0.22 pts/nurse/15m
    const rawCapacity = (doctorsAvailable * 0.46) + (nursesAvailable * 0.22);
    // Capacity degradation factor when queue is huge (cognitive load / crowding friction)
    const crowdingDrag = currentWaitingQueue > 30 ? 0.88 : 1.0;
    const treatmentCapacity = Math.max(3, Math.round(rawCapacity * crowdingDrag));

    // Patients actually treated in this 15m interval
    const treatableQueue = currentWaitingQueue + patientsArrived;
    const patientsTreated = Math.min(treatableQueue, Math.max(2, Math.round(treatmentCapacity + rng.gaussian(0, 0.8))));

    // 6. QUEUE DYNAMICS
    // Unmet demand carries over to the waiting queue
    currentWaitingQueue = Math.max(0, currentWaitingQueue + patientsArrived - patientsTreated);
    // Queue cannot exceed physical waiting area with overflow
    currentWaitingQueue = Math.min(48, currentWaitingQueue);

    // 7. INPATIENT ADMISSIONS & DISCHARGES (BED COUPLING)
    // Roughly 20-25% of ED patients require inpatient admission
    let admissionProbability = 0.22;
    if (isSurge1 || isSurge2) admissionProbability = 0.32; // higher acuity in surges

    const admissions = Math.max(0, Math.round(patientsTreated * admissionProbability + rng.gaussian(0, 0.7)));

    // Discharges from inpatient beds (freeing up acute beds)
    // Mostly occur during late morning & afternoon (10:00 - 17:00) when attending physicians round
    let dischargeRate = 0.8;
    if (hourOfDay >= 10 && hourOfDay <= 17) {
      dischargeRate = 2.4;
    } else if (hourOfDay >= 18 && hourOfDay <= 21) {
      dischargeRate = 1.2;
    } else {
      dischargeRate = 0.3; // minimal overnight inpatient discharges
    }

    // During recovery, rapid discharge team accelerates bed turnover
    if (isRecovery1 && hourOfDay >= 8) {
      dischargeRate *= 1.8;
    }

    const discharges = Math.max(0, Math.round(dischargeRate + rng.gaussian(0, 0.6)));

    // Update acute bed occupancy
    currentBedsOccupied = Math.min(
      bedsTotal,
      Math.max(32, currentBedsOccupied + admissions - discharges)
    );
    const bedsAvailable = Math.max(0, bedsTotal - currentBedsOccupied);

    // 8. WAIT TIME & TREATMENT TIME CAUSAL DYNAMICS
    // Average wait time increases with waiting queue length and bed blocking
    const bedBlockPenalty = bedsAvailable <= 8 ? (8 - bedsAvailable) * 3.5 : 0;
    const queueDelay = (currentWaitingQueue / Math.max(1, doctorsAvailable)) * 14;
    const nominalWait = 18;
    currentWaitTime = Math.min(110, Math.max(12, Math.round(nominalWait + queueDelay + bedBlockPenalty + rng.gaussian(0, 2.5))));

    // Average treatment time varies by patient complexity and bed availability
    const nominalTreatmentTime = 52;
    const boardingDelay = bedsAvailable <= 5 ? 18 : 0;
    currentTreatmentTime = Math.min(95, Math.max(38, Math.round(nominalTreatmentTime + boardingDelay + rng.gaussian(0, 3))));

    // 9. CONGESTION SCORE
    const congestionScore = computeCongestionScore(
      currentBedsOccupied,
      bedsTotal,
      currentWaitingQueue,
      patientsArrived,
      currentWaitTime
    );

    records.push({
      timestamp: timestamp.toISOString(),
      timeIndex: step,
      dayOfWeek,
      hourOfDay,
      minuteOfHour,
      patientsArrived,
      arrivalBaseline: Math.round(baselineArrivalPerQuarter * 4),
      ambulanceArrivals: emsArrivals,
      patientsWaiting: currentWaitingQueue,
      patientsTreated,
      treatmentCapacity,
      bedsTotal,
      bedsOccupied: currentBedsOccupied,
      bedsAvailable,
      doctorsAvailable,
      nursesAvailable,
      supportStaffAvailable,
      averageWaitTime: currentWaitTime,
      averageTreatmentTime: currentTreatmentTime,
      admissions,
      discharges,
      isSurgeEvent: isSurge1 || isSurge2,
      isRecoveryPeriod: isRecovery1,
      congestionScore,
      highCongestionNext60Min: 0, // computed in lookahead pass
      congestionNext30Min: congestionScore,
      congestionNext60Min: congestionScore,
      congestionNext90Min: congestionScore,
      congestionNext120Min: congestionScore,
    });
  }

  // 10. SECOND PASS: COMPUTE SUPERVISED TARGETS LOOKAHEAD
  // Each step looks forward:
  // 30 min = +2 steps
  // 60 min = +4 steps
  // 90 min = +6 steps
  // 120 min = +8 steps
  for (let i = 0; i < totalIntervals; i++) {
    const record = records[i];

    // Check if ANY of the next 4 intervals (t+1..t+4) enters a high congestion state
    let entersHighNext60 = false;
    for (let offset = 1; offset <= 4; offset++) {
      const futureIdx = i + offset;
      if (futureIdx < records.length) {
        const f = records[futureIdx];
        if (isHighCongestionState(f.congestionScore, f.bedsAvailable, f.patientsWaiting, f.averageWaitTime)) {
          entersHighNext60 = true;
          break;
        }
      }
    }
    record.highCongestionNext60Min = entersHighNext60 ? 1 : 0;

    // Multi-horizon continuous targets
    const idx30 = Math.min(records.length - 1, i + 2);
    const idx60 = Math.min(records.length - 1, i + 4);
    const idx90 = Math.min(records.length - 1, i + 6);
    const idx120 = Math.min(records.length - 1, i + 8);

    record.congestionNext30Min = records[idx30].congestionScore;
    record.congestionNext60Min = records[idx60].congestionScore;
    record.congestionNext90Min = records[idx90].congestionScore;
    record.congestionNext120Min = records[idx120].congestionScore;
  }

  // Return the primary 7-day observation set (672 rows)
  return records.slice(0, totalIntervals);
}

/**
 * Generates an analytical summary of the synthetic dataset for ML exploration and transparency
 */
export function summarizeDataset(records: SyntheticHospitalRecord[]): DatasetSummary {
  const total = records.length;
  if (total === 0) {
    throw new Error('Cannot summarize empty dataset');
  }

  let sumArrivals = 0;
  let sumAmbulances = 0;
  let sumWaiting = 0;
  let sumBedsOccupied = 0;
  let sumBedsAvailable = 0;
  let sumWaitTime = 0;
  let sumCongestion = 0;
  let highCongestionCount = 0;
  let surgeCount = 0;
  let recoveryCount = 0;

  for (const r of records) {
    sumArrivals += r.patientsArrived;
    sumAmbulances += r.ambulanceArrivals;
    sumWaiting += r.patientsWaiting;
    sumBedsOccupied += r.bedsOccupied;
    sumBedsAvailable += r.bedsAvailable;
    sumWaitTime += r.averageWaitTime;
    sumCongestion += r.congestionScore;
    if (r.highCongestionNext60Min === 1) highCongestionCount++;
    if (r.isSurgeEvent) surgeCount++;
    if (r.isRecoveryPeriod) recoveryCount++;
  }

  return {
    totalRecords: total,
    intervalMinutes: 15,
    totalDays: Math.round(total / (24 * 4)),
    startDate: records[0].timestamp,
    endDate: records[total - 1].timestamp,
    highCongestionRatePercent: Math.round((highCongestionCount / total) * 1000) / 10,
    surgeEventsCount: 2, // 2 distinct multi-hour surge windows
    recoveryPeriodsCount: 1,
    metricsSummary: {
      avgArrivalsPerInterval: Math.round((sumArrivals / total) * 10) / 10,
      avgAmbulancePerInterval: Math.round((sumAmbulances / total) * 10) / 10,
      avgPatientsWaiting: Math.round((sumWaiting / total) * 10) / 10,
      avgBedsOccupied: Math.round((sumBedsOccupied / total) * 10) / 10,
      avgBedsAvailable: Math.round((sumBedsAvailable / total) * 10) / 10,
      avgWaitTimeMinutes: Math.round((sumWaitTime / total) * 10) / 10,
      avgCongestionScore: Math.round((sumCongestion / total) * 10) / 10,
    },
    targetDefinitionDocumentation: {
      targetName: 'highCongestionNext60Min',
      horizon: '60 minutes forward (4 sequential 15-minute intervals)',
      formula:
        'Score = 0.35*(BedsOcc/BedsTot) + 0.30*(WaitQueue/35) + 0.20*(Arrivals*4/32) + 0.15*(WaitTime/60)',
      thresholdConditions: [
        'Congestion Score >= 80.0%',
        'Acute beds available <= 5 AND patients waiting >= 28',
        'Average wait time >= 65 minutes',
      ],
      clinicalDisclaimer:
        'Prototype operational engineering heuristic. Not a clinical risk stratification score.',
    },
  };
}
