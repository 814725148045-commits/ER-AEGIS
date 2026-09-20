import { HospitalMetrics } from '../types';

export function generate24HourHistory(baseDate: Date = new Date()): HospitalMetrics[] {
  const history: HospitalMetrics[] = [];
  const totalHours = 24;

  for (let i = totalHours; i >= 0; i--) {
    const timestamp = new Date(baseDate.getTime() - i * 60 * 60 * 1000);
    const hour = timestamp.getHours();
    const displayTime = `${hour.toString().padStart(2, '0')}:00`;

    // Diurnal rhythm curve: low late night (02:00-06:00), rising morning (08:00-11:00), plateau afternoon, peak evening (17:00-21:00)
    let diurnalFactor = 1.0;
    if (hour >= 1 && hour <= 6) diurnalFactor = 0.45;
    else if (hour >= 7 && hour <= 11) diurnalFactor = 1.1;
    else if (hour >= 12 && hour <= 16) diurnalFactor = 1.25;
    else if (hour >= 17 && hour <= 21) diurnalFactor = 1.45;
    else diurnalFactor = 0.85;

    // Simulated historical surge spike 5 hours ago (e.g. multi-vehicle collision / community virus spike)
    const isHistoricalSurgeHour = i === 5;
    const surgeMultiplier = isHistoricalSurgeHour ? 1.4 : 1.0;

    const arrivalBaseline = 26;
    const patientsArrived = Math.round(arrivalBaseline * diurnalFactor * surgeMultiplier + (Math.sin(i) * 2));
    const ambulanceArrivals = Math.max(1, Math.round(patientsArrived * 0.18 + (isHistoricalSurgeHour ? 4 : 0)));

    // Beds: Total 70
    const bedsTotal = 70;
    let bedsOccupied = Math.min(68, Math.round(48 + diurnalFactor * 10 + (isHistoricalSurgeHour ? 8 : 0)));
    const bedsAvailable = Math.max(2, bedsTotal - bedsOccupied);

    // Waiting queue
    const waitingCapacity = 40;
    const patientsWaiting = Math.min(38, Math.max(8, Math.round(patientsArrived * 0.95 - (diurnalFactor < 0.7 ? 4 : 0))));

    // Staffing
    const staffDoctors = hour >= 23 || hour <= 6 ? 8 : 12;
    const staffDoctorsTotal = 15;
    const staffNurses = hour >= 23 || hour <= 6 ? 16 : 24;
    const staffNursesTotal = 30;
    const staffSupport = 8;
    const staffSupportTotal = 10;

    // Wait time & Congestion risk
    const waitTimeBase = Math.round(20 + (patientsWaiting * 0.9) + (bedsOccupied > 60 ? (bedsOccupied - 60) * 1.8 : 0));
    const congestionRisk = Math.min(96, Math.max(28, Math.round(
      (bedsOccupied / bedsTotal) * 45 +
      (patientsWaiting / waitingCapacity) * 35 +
      (patientsArrived / 35) * 20
    )));

    history.push({
      timestamp: timestamp.toISOString(),
      displayTime,
      patientsArrived,
      arrivalBaseline,
      ambulanceArrivals,
      patientsWaiting,
      waitingCapacity,
      patientsTreated: Math.round(patientsArrived * 0.88),
      bedsTotal,
      bedsOccupied,
      bedsAvailable,
      staffDoctors,
      staffDoctorsTotal,
      staffNurses,
      staffNursesTotal,
      staffSupport,
      staffSupportTotal,
      ambulanceIncoming: Math.min(5, Math.max(1, Math.round(ambulanceArrivals * 0.7))),
      ambulanceBaysAvailable: Math.max(1, 5 - Math.round(ambulanceArrivals * 0.6)),
      ambulanceBaysTotal: 5,
      averageWaitTime: waitTimeBase,
      averageTreatmentTime: 142,
      admissions: Math.round(patientsArrived * 0.28),
      discharges: Math.round(patientsArrived * 0.24),
      congestionRisk,
      prevHourCongestionRisk: Math.max(20, congestionRisk - 6),
      prevHourWaitTime: Math.max(15, waitTimeBase - 5),
    });
  }

  return history;
}

// Initial default operational state (matching the user's explicit KPI card examples: 82% congestion, 47m wait, 8 beds available, 34/hr arrivals)
export const initialHospitalState: HospitalMetrics = {
  timestamp: new Date().toISOString(),
  displayTime: "14:45",
  patientsArrived: 34,
  arrivalBaseline: 26,
  ambulanceArrivals: 6,
  patientsWaiting: 31,
  waitingCapacity: 40,
  patientsTreated: 29,
  bedsTotal: 70,
  bedsOccupied: 62,
  bedsAvailable: 8,
  staffDoctors: 12,
  staffDoctorsTotal: 15,
  staffNurses: 24,
  staffNursesTotal: 30,
  staffSupport: 8,
  staffSupportTotal: 10,
  ambulanceIncoming: 3,
  ambulanceBaysAvailable: 2,
  ambulanceBaysTotal: 5,
  averageWaitTime: 47,
  averageTreatmentTime: 142,
  admissions: 11,
  discharges: 8,
  congestionRisk: 82,
  prevHourCongestionRisk: 68, // ↑ 14% vs previous hour
  prevHourWaitTime: 38, // ↑ 9 min vs previous hour
};
