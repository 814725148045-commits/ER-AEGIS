import React, { useState, useMemo, useEffect } from 'react';
import { HospitalMetrics, WhatIfParameters } from '../types';
import { predictionService } from '../services/predictionService';
import { erAegisApi, ApiSimulationResponse } from '../services/api';
import { Sliders, RotateCcw, TrendingDown, TrendingUp, Sparkles, Check, ArrowRight, Cpu } from 'lucide-react';

interface WhatIfSimulatorProps {
  metrics: HospitalMetrics;
  surgeActive: boolean;
  mlPrediction?: {
    congestionProbability: number;
    predictedCongestionLevel?: string;
    rawRiskLevel?: string;
    predictionHorizonMinutes?: number;
    modelName?: string;
  };
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({ metrics, surgeActive, mlPrediction }) => {
  const [params, setParams] = useState<WhatIfParameters>({
    additionalBeds: 4,
    additionalNurses: 2,
    additionalDoctors: 0,
    arrivalSurge: surgeActive ? 30 : 0,
    treatmentCapacity: 10,
  });
  const [apiSimResult, setApiSimResult] = useState<ApiSimulationResponse | null>(null);

  useEffect(() => {
    let active = true;
    erAegisApi
      .runSimulation({
        additional_doctors: params.additionalDoctors,
        additional_nurses: params.additionalNurses,
        additional_beds: params.additionalBeds,
        arrival_increase_percent: params.arrivalSurge,
      })
      .then((res) => {
        if (active) setApiSimResult(res);
      })
      .catch(() => {
        // Safe fallback to client-side heuristics
      });
    return () => {
      active = false;
    };
  }, [params.additionalDoctors, params.additionalNurses, params.additionalBeds, params.arrivalSurge]);

  const simResult = useMemo(() => {
    return predictionService.simulateWhatIf(metrics, params);
  }, [metrics, params]);

  const handleReset = () => {
    setParams({
      additionalBeds: 0,
      additionalNurses: 0,
      additionalDoctors: 0,
      arrivalSurge: 0,
      treatmentCapacity: 0,
    });
  };

  const handlePresetSurgeRelief = () => {
    setParams({
      additionalBeds: 6,
      additionalNurses: 4,
      additionalDoctors: 2,
      arrivalSurge: 0,
      treatmentCapacity: 15,
    });
  };

  const handlePresetHighArrivals = () => {
    setParams({
      additionalBeds: 0,
      additionalNurses: 0,
      additionalDoctors: 0,
      arrivalSurge: 50,
      treatmentCapacity: 0,
    });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-cyan-500/15 p-1.5 text-cyan-400 ring-1 ring-cyan-500/30">
              <Sliders className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white">What-If Simulator</h2>
            <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
              Deterministic Scenario Engine
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Simulate staffing reallocations, bed additions, and arrival surges to project capacity impacts before execution.
          </p>
        </div>

        {/* Quick presets & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePresetSurgeRelief}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Preset: +6 Beds & Staff
          </button>
          <button
            onClick={handlePresetHighArrivals}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-slate-700"
          >
            Preset: +50% Surge
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 p-1.5 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="Reset parameters"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Controls on Left, Results Matrix on Right */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls Column (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Operational Levers & Variables
          </h3>

          {/* Additional Beds Slider */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Additional Beds</span>
              <span className="font-mono font-bold text-cyan-400">+{params.additionalBeds} beds</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={params.additionalBeds}
              onChange={(e) => setParams({ ...params, additionalBeds: Number(e.target.value) })}
              className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0</span>
              <span>10</span>
              <span>20</span>
            </div>
          </div>

          {/* Additional Nurses Slider */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Additional Nurses</span>
              <span className="font-mono font-bold text-indigo-400">+{params.additionalNurses} nurses</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={params.additionalNurses}
              onChange={(e) => setParams({ ...params, additionalNurses: Number(e.target.value) })}
              className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Additional Doctors Slider */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Additional Doctors</span>
              <span className="font-mono font-bold text-blue-400">+{params.additionalDoctors} doctors</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={params.additionalDoctors}
              onChange={(e) => setParams({ ...params, additionalDoctors: Number(e.target.value) })}
              className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-blue-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0</span>
              <span>2</span>
              <span>5</span>
            </div>
          </div>

          {/* Arrival Surge Slider */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Arrival Surge</span>
              <span
                className={`font-mono font-bold ${
                  params.arrivalSurge > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {params.arrivalSurge > 0 ? `+${params.arrivalSurge}%` : `${params.arrivalSurge}%`}
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="100"
              step="5"
              value={params.arrivalSurge}
              onChange={(e) => setParams({ ...params, arrivalSurge: Number(e.target.value) })}
              className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-amber-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-20%</span>
              <span>+40%</span>
              <span>+100%</span>
            </div>
          </div>

          {/* Treatment Capacity Adjustment */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Treatment Capacity Change</span>
              <span
                className={`font-mono font-bold ${
                  params.treatmentCapacity > 0 ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {params.treatmentCapacity > 0
                  ? `+${params.treatmentCapacity}%`
                  : `${params.treatmentCapacity}%`}
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="30"
              step="5"
              value={params.treatmentCapacity}
              onChange={(e) => setParams({ ...params, treatmentCapacity: Number(e.target.value) })}
              className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-20%</span>
              <span>0%</span>
              <span>+30%</span>
            </div>
          </div>
        </div>

        {/* Comparison & Projection Matrix Column (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Comparative Impact Analysis
              </h3>
              <span className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 ring-1 ring-indigo-500/30">
                <Sliders className="h-3 w-3" />
                Scenario Projection Engine
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Active Parameters: +{params.additionalBeds} beds, +{params.additionalNurses} nurses
            </span>
          </div>

          {/* Side-by-side Baseline vs Simulation Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* BASELINE CARD */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Current Baseline
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                  OBSERVED TELEMETRY
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-[11px] text-slate-400">Current Operational Congestion</div>
                  <div className="mt-0.5 text-2xl font-extrabold font-mono text-white">
                    {metrics.congestionScore !== undefined ? metrics.congestionScore.toFixed(1) : simResult.baseline.congestionRisk}
                    <span className="text-sm font-normal text-slate-400 ml-1">/ 100</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-cyan-400" />
                      Baseline ML 60m Risk:
                    </span>
                    <span className="font-mono font-bold text-cyan-400">
                      {mlPrediction ? `${Math.round(mlPrediction.congestionProbability * 100)}% (${mlPrediction.rawRiskLevel || 'LOW'})` : '15% (LOW)'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400">Current Wait Time</div>
                  <div className="mt-0.5 text-xl font-bold font-mono text-slate-200">
                    {simResult.baseline.waitTime} min
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Bed Occupancy:</span>
                    <span className="font-mono text-slate-200">{simResult.baseline.bedOccupancyRate}%</span>
                  </div>
                  <div className="mt-1 flex justify-between text-slate-400">
                    <span>Patient/Nurse Ratio:</span>
                    <span className="font-mono text-slate-200">{simResult.baseline.staffRatio} : 1</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SIMULATED SCENARIO CARD */}
            <div
              className={`rounded-xl border p-4 shadow-lg transition-all ${
                simResult.deltas.congestionDelta < 0
                  ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 to-slate-950'
                  : 'border-rose-500/40 bg-gradient-to-br from-rose-950/20 to-slate-950'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Scenario Projection
                </span>
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold font-mono text-cyan-300">
                  DETERMINISTIC PROJECTION
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="text-[11px] text-slate-400">Simulated Congestion Score</div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold font-mono text-white">
                      {simResult.simulated.congestionRisk}
                    </span>
                    <span className="text-sm font-normal text-slate-400">/ 100</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        simResult.deltas.congestionDelta <= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {simResult.deltas.congestionDelta <= 0
                        ? `↓ ${Math.abs(simResult.deltas.congestionDelta)} pts`
                        : `↑ ${simResult.deltas.congestionDelta} pts`}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Projection Method:</span>
                    <span className="font-mono text-slate-300">Deterministic Simulation</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400">Simulated Wait Time</div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-xl font-bold font-mono text-slate-200">
                      {simResult.simulated.waitTime} min
                    </span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        simResult.deltas.waitTimeDelta <= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {simResult.deltas.waitTimeDelta <= 0
                        ? `↓ ${Math.abs(simResult.deltas.waitTimeDelta)} min`
                        : `↑ ${simResult.deltas.waitTimeDelta} min`}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Simulated Bed Occupancy:</span>
                    <span className="font-mono text-slate-200">{simResult.simulated.bedOccupancyRate}%</span>
                  </div>
                  <div className="mt-1 flex justify-between text-slate-400">
                    <span>Simulated Patient/Nurse:</span>
                    <span className="font-mono text-slate-200">{simResult.simulated.staffRatio} : 1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Scenario Summary Banner */}
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-4">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 text-cyan-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  Operational Assessment
                </h4>
                <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                  {simResult.impactSummary}
                </p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 italic">
            *Simulation engine calculations use transparent deterministic operational formulas for demonstration. Not clinically validated.
          </p>
        </div>
      </div>
    </div>
  );
};
