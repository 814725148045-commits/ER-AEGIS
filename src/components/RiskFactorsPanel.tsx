import React, { useState } from 'react';
import { HospitalMetrics, RiskFactor } from '../types';
import {
  Sparkles,
  Users,
  Bed,
  Clock,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RiskFactorsPanelProps {
  factors: RiskFactor[];
  surgeActive: boolean;
  congestionRisk: number;
  operationalScore?: number;
  metrics?: HospitalMetrics;
  mlPrediction?: {
    congestionProbability: number;
    predictedCongestionLevel?: string;
    rawRiskLevel?: string;
    predictionHorizonMinutes?: number;
    primaryDriver?: string;
    modelName?: string;
  };
}

export const RiskFactorsPanel: React.FC<RiskFactorsPanelProps> = ({
  factors,
  surgeActive,
  congestionRisk,
  operationalScore,
  metrics,
  mlPrediction,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // 1. Primary probability and horizon from backend ML prediction
  const prob = mlPrediction?.congestionProbability ?? (congestionRisk / 100);
  const probPercent = Math.round(prob * 100);
  const horizon = mlPrediction?.predictionHorizonMinutes ?? 60;
  const opScore = operationalScore !== undefined ? operationalScore.toFixed(1) : String(congestionRisk);

  // 2. Risk classification
  const isCritical = surgeActive || prob >= 0.85 || mlPrediction?.rawRiskLevel === 'CRITICAL';
  const isHigh = !isCritical && (prob >= 0.65 || mlPrediction?.rawRiskLevel === 'HIGH');
  const isModerate = !isCritical && !isHigh && (prob >= 0.35 || mlPrediction?.rawRiskLevel === 'MODERATE');

  let riskLabel = 'LOW RISK';
  let dotColor = 'bg-emerald-400';
  let textColor = 'text-emerald-400';
  let operatorTakeaway = 'Overload is unlikely in the next hour.';

  if (isCritical) {
    riskLabel = 'CRITICAL RISK';
    dotColor = 'bg-rose-500 animate-pulse';
    textColor = 'text-rose-400';
    operatorTakeaway = 'Overload risk is critical. Immediate operational preparation is recommended.';
  } else if (isHigh) {
    riskLabel = 'HIGH RISK';
    dotColor = 'bg-rose-400';
    textColor = 'text-rose-400';
    operatorTakeaway = 'Overload risk is high. Action may be needed before the next hour.';
  } else if (isModerate) {
    riskLabel = 'MODERATE RISK';
    dotColor = 'bg-amber-400';
    textColor = 'text-amber-400';
    operatorTakeaway = 'Pressure is building. The next hour needs monitoring.';
  }

  // 3. Operational signals grounded in real backend values
  const arrivalsFactor = factors.find((f) => f.id === 'rf-arrivals');
  const bedsFactor = factors.find((f) => f.id === 'rf-beds');
  const waitFactor = factors.find((f) => f.id === 'rf-wait');
  const staffFactor = factors.find((f) => f.id === 'rf-staff');

  const arrivalsNum = metrics?.patientsArrived ?? (
    arrivalsFactor ? parseInt(arrivalsFactor.changeValue.replace(/\D/g, ''), 10) || 1 : 1
  );

  const bedsAvailableNum = metrics?.bedsAvailable ?? (
    bedsFactor ? parseInt(bedsFactor.changeValue.replace(/\D/g, ''), 10) || 13 : 13
  );

  const bedsTotal = metrics?.bedsTotal || 70;
  const bedsOccupied = metrics?.bedsOccupied || (bedsTotal - bedsAvailableNum);
  const occupancyPercent = metrics?.bedOccupancyRate
    ? Math.round(metrics.bedOccupancyRate * 100)
    : Math.round((bedsOccupied / bedsTotal) * 100);

  const waitMinutesNum = metrics?.averageWaitTime ?? (
    waitFactor ? parseInt(waitFactor.changeValue.replace(/\D/g, ''), 10) || 67 : 67
  );

  const staffNursesNum = metrics?.staffNurses ?? (
    staffFactor ? parseInt(staffFactor.changeValue.replace(/\D/g, ''), 10) || 17 : 17
  );

  // 4. Cause prioritization (Plain operational language answering "WHY?" based on top 1-2 factors)
  let whyExplanation = '';
  if (surgeActive) {
    whyExplanation = 'Sudden arrival surge is rapidly exhausting emergency and acute beds.';
  } else if (arrivalsNum >= 25 && bedsAvailableNum <= 10) {
    whyExplanation = 'Arrivals are rising while available beds are falling.';
  } else if (occupancyPercent >= 75 && arrivalsNum <= 12) {
    whyExplanation = 'Beds are getting tight, but patient arrivals are currently low.';
  } else if (occupancyPercent >= 80 && waitMinutesNum >= 60) {
    whyExplanation = 'Beds are nearly full and waiting times are elevated.';
  } else if (staffNursesNum < 12) {
    whyExplanation = 'Staff availability is limiting patient throughput.';
  } else if (arrivalsNum >= 20) {
    whyExplanation = 'Patient arrivals are rising and triage queues are building.';
  } else {
    whyExplanation = 'Patient arrivals are currently stable and bed capacity is adequate.';
  }

  // Key signals data
  const keySignals = [
    {
      id: 'arrivals',
      label: 'ARRIVALS',
      value: String(arrivalsNum),
      unit: '/ hr',
      icon: <Users className="h-4 w-4 text-cyan-400" />,
    },
    {
      id: 'beds',
      label: 'BEDS AVAILABLE',
      value: String(bedsAvailableNum),
      unit: '',
      icon: <Bed className="h-4 w-4 text-rose-400" />,
    },
    {
      id: 'wait',
      label: 'WAIT TIME',
      value: String(waitMinutesNum),
      unit: 'min',
      icon: <Clock className="h-4 w-4 text-amber-400" />,
    },
    {
      id: 'staff',
      label: 'STAFF AVAILABLE',
      value: String(staffNursesNum),
      unit: 'RNs',
      icon: <UserCheck className="h-4 w-4 text-indigo-400" />,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40">
      {/* Title & Secondary Forecast Tag */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-500/15 p-1.5 text-indigo-400 ring-1 ring-indigo-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold tracking-tight text-white">
            Why is congestion changing?
          </h2>
        </div>
        <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 border border-slate-700/50 whitespace-nowrap">
          AI-powered operational forecast
        </span>
      </div>

      {/* 1. PRIMARY MESSAGE: Visual dominant risk headline */}
      <div className="mt-4 rounded-lg border border-slate-800/90 bg-slate-950/70 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${dotColor}`} />
            <span className={`text-base sm:text-lg font-extrabold tracking-tight ${textColor}`}>
              {riskLabel}
            </span>
          </div>
          <span className="rounded bg-slate-800/90 px-2 py-0.5 font-mono text-xs font-semibold text-slate-300 border border-slate-700/40">
            {probPercent}% probability
          </span>
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-300 font-medium leading-normal">
          {probPercent}% chance of high congestion in the next {horizon} min
        </p>
      </div>

      {/* 2. SIMPLE EXPLANATION (WHY? + What to know) */}
      <div className="mt-3.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-3.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          WHY?
        </div>
        <p className="mt-1 text-sm font-semibold text-white leading-snug">
          {whyExplanation}
        </p>
        <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
          <span className="font-medium">{operatorTakeaway}</span>
        </div>
      </div>

      {/* 3. KEY SIGNALS: 4 concise metric cards in responsive grid */}
      <div className="mt-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          KEY SIGNALS
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {keySignals.map((signal) => (
            <div
              key={signal.id}
              className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-2.5 transition-all hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  {signal.label}
                </span>
                <div className="rounded p-1 bg-slate-900/90 shrink-0">
                  {signal.icon}
                </div>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white">
                  {signal.value}
                </span>
                {signal.unit && (
                  <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                    {signal.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. OPTIONAL DETAILS (Expandable technical disclosure) */}
      <div className="mt-4 pt-3 border-t border-slate-800/70">
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex w-full items-center justify-between text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span>Operational details & model telemetry</span>
          <span className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold">
            <span>{showDetails ? 'Hide details' : 'View details'}</span>
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>

        {showDetails && (
          <div className="mt-2.5 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">ML Model:</span>
                <span className="font-mono text-slate-200">{mlPrediction?.modelName || 'Random Forest'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Forecast Horizon:</span>
                <span className="font-mono text-slate-200">{horizon} minutes</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Current Congestion:</span>
                <span className="font-mono text-slate-200">{opScore} / 100</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Bed Occupancy:</span>
                <span className="font-mono text-slate-200">{occupancyPercent}% ({bedsOccupied}/{bedsTotal})</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 italic">
              Operational decision-support prototype. Telemetry and prediction derived from continuous emergency department state monitoring.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
