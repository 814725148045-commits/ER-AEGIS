import { HospitalMetrics, Recommendation } from '../types';
import { initialHospitalState } from '../data/mockHistoricalData';

export type StateListener = (state: SimulationState) => void;

export interface SimulationState {
  metrics: HospitalMetrics;
  surgeActive: boolean;
  simulatedTime: Date;
  isPaused: boolean;
  appliedRecommendationIds: string[];
}

class SimulationEngine {
  private state: SimulationState;
  private listeners: Set<StateListener> = new Set();
  private timer: any = null;

  constructor() {
    this.state = {
      metrics: { ...initialHospitalState },
      surgeActive: false,
      simulatedTime: new Date(2026, 8, 18, 14, 45, 0),
      isPaused: false,
      appliedRecommendationIds: [],
    };
  }

  public updateMetricsFromApi(data: Partial<HospitalMetrics>) {
    this.state.metrics = {
      ...this.state.metrics,
      ...data,
    };
    this.notify();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SimulationState {
    return {
      ...this.state,
      metrics: { ...this.state.metrics },
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => listener(currentState));
  }

  public start(intervalMs: number = 8000) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (!this.state.isPaused) {
        this.tick();
      }
    }, intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public togglePause() {
    this.state.isPaused = !this.state.isPaused;
    this.notify();
  }

  public setSurgeMode(active: boolean) {
    this.state.surgeActive = active;

    if (active) {
      // Prompt requirements for Surge Mode:
      // Patient arrivals: +60% (34 * 1.6 = ~54)
      // Available beds: -30% (8 * 0.7 = ~5) -> bedsOccupied: 65
      // Waiting patients: +45% (31 * 1.45 = ~45)
      // Congestion risk spikes to 95-97%
      // Average wait time jumps from 47 to 74 min
      this.state.metrics = {
        ...this.state.metrics,
        patientsArrived: 54,
        arrivalBaseline: 26,
        ambulanceArrivals: 9,
        ambulanceIncoming: 5,
        ambulanceBaysAvailable: 1,
        patientsWaiting: 45,
        bedsOccupied: 65,
        bedsAvailable: 5,
        averageWaitTime: 74,
        congestionRisk: 95,
        prevHourCongestionRisk: 82,
        prevHourWaitTime: 47,
      };
    } else {
      // Revert to normal baseline, accounting for applied recommendations
      const hasBedsAdded = this.state.appliedRecommendationIds.includes('rec-1');
      const hasNursesAdded = this.state.appliedRecommendationIds.includes('rec-2');

      const normalBedsTotal = 70 + (hasBedsAdded ? 4 : 0);
      const normalBedsOccupied = 62;
      const normalAvailable = normalBedsTotal - normalBedsOccupied;
      const normalWait = 47 - (hasNursesAdded ? 8 : 0) - (hasBedsAdded ? 5 : 0);
      const normalCongestion = 82 - (hasBedsAdded ? 8 : 0) - (hasNursesAdded ? 6 : 0);

      this.state.metrics = {
        ...initialHospitalState,
        bedsTotal: normalBedsTotal,
        bedsAvailable: normalAvailable,
        averageWaitTime: Math.max(25, normalWait),
        congestionRisk: Math.max(50, normalCongestion),
      };
    }

    this.notify();
  }

  public applyRecommendation(rec: Recommendation) {
    if (this.state.appliedRecommendationIds.includes(rec.id)) return;

    this.state.appliedRecommendationIds.push(rec.id);

    // Apply immediate tangible operational impact to state
    if (rec.actionType === 'OPEN_BEDS') {
      const addedBeds = 4;
      this.state.metrics.bedsTotal += addedBeds;
      this.state.metrics.bedsAvailable += addedBeds;
      this.state.metrics.congestionRisk = Math.max(30, this.state.metrics.congestionRisk - rec.impactPercentage);
      this.state.metrics.averageWaitTime = Math.max(15, this.state.metrics.averageWaitTime - 7);
    } else if (rec.actionType === 'REALLOCATE_NURSES') {
      this.state.metrics.staffNurses = Math.min(this.state.metrics.staffNursesTotal, this.state.metrics.staffNurses + 2);
      this.state.metrics.congestionRisk = Math.max(30, this.state.metrics.congestionRisk - rec.impactPercentage);
      this.state.metrics.averageWaitTime = Math.max(15, this.state.metrics.averageWaitTime - 9);
      this.state.metrics.patientsWaiting = Math.max(5, this.state.metrics.patientsWaiting - 4);
    } else if (rec.actionType === 'PREPARE_OVERFLOW') {
      this.state.metrics.waitingCapacity += 15;
      this.state.metrics.congestionRisk = Math.max(30, this.state.metrics.congestionRisk - rec.impactPercentage);
    } else if (rec.actionType === 'EMS_DIVERSION') {
      this.state.metrics.ambulanceIncoming = Math.max(1, this.state.metrics.ambulanceIncoming - 2);
      this.state.metrics.congestionRisk = Math.max(30, this.state.metrics.congestionRisk - rec.impactPercentage);
      this.state.metrics.averageWaitTime = Math.max(15, this.state.metrics.averageWaitTime - 6);
    }

    this.notify();
  }

  public resetToBaseline() {
    this.state.surgeActive = false;
    this.state.appliedRecommendationIds = [];
    this.state.metrics = { ...initialHospitalState };
    this.state.simulatedTime = new Date(2026, 8, 18, 14, 45, 0);
    this.notify();
  }

  public tick() {
    // Advance simulated time by 2 minutes
    this.state.simulatedTime = new Date(this.state.simulatedTime.getTime() + 2 * 60 * 1000);
    
    // Minor realistic stochastic fluctuations while preserving operational relations
    const hours = this.state.simulatedTime.getHours();
    const minutes = this.state.simulatedTime.getMinutes();
    this.state.metrics.displayTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    if (!this.state.surgeActive) {
      // Gentle operational drift
      const deltaArrival = (Math.random() > 0.5 ? 1 : -1) * (Math.random() > 0.7 ? 1 : 0);
      this.state.metrics.patientsArrived = Math.max(20, Math.min(45, this.state.metrics.patientsArrived + deltaArrival));
      
      // If arrivals high, waiting increases
      if (this.state.metrics.patientsArrived > 30) {
        this.state.metrics.patientsWaiting = Math.min(this.state.metrics.waitingCapacity - 2, this.state.metrics.patientsWaiting + (Math.random() > 0.6 ? 1 : 0));
      }
    } else {
      // In surge mode, keep high pressure with slight turbulence
      this.state.metrics.patientsWaiting = Math.min(this.state.metrics.waitingCapacity + 10, 44 + Math.round(Math.random() * 3));
    }

    this.notify();
  }
}

export const simulationEngine = new SimulationEngine();
// Start clock
simulationEngine.start(10000);
