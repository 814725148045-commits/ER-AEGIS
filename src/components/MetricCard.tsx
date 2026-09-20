import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Bed, Users, Clock, Flame } from 'lucide-react';
import { HospitalMetrics } from '../types';

interface MetricCardProps {
  metrics: HospitalMetrics;
  surgeActive: boolean;
}

export const MetricCardsGrid: React.FC<MetricCardProps> = ({ metrics, surgeActive }) => {
  // 1. Congestion Risk calculations
  const congestionDelta = metrics.congestionRisk - metrics.prevHourCongestionRisk;
  const isCongestionCritical = metrics.congestionRisk >= 90;
  const isCongestionHigh = metrics.congestionRisk >= 80;

  // 2. Wait Time calculations
  const waitDelta = metrics.averageWaitTime - metrics.prevHourWaitTime;

  // 3. Beds calculations
  const occupancyPercentage = Math.round((metrics.bedsOccupied / metrics.bedsTotal) * 100);

  // 4. Arrivals calculations
  const arrivalDeltaFromBaseline = metrics.patientsArrived - metrics.arrivalBaseline;
  const arrivalPercentAboveBaseline = Math.round(
    ((metrics.patientsArrived - metrics.arrivalBaseline) / metrics.arrivalBaseline) * 100
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI CARD 1 — CONGESTION RISK */}
      <div
        id="kpi-congestion-risk"
        className={`relative overflow-hidden rounded-xl border p-4.5 transition-all shadow-lg ${
          isCongestionCritical
            ? 'border-rose-500/50 bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 shadow-rose-950/30'
            : isCongestionHigh
            ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 shadow-amber-950/20'
            : 'border-slate-800 bg-slate-900/90 shadow-slate-950/40'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400 block">
              Current Operational Congestion
            </span>
            <span className="text-[10px] text-slate-500">Observed composite score</span>
          </div>
          <div
            className={`rounded-full p-1.5 ${
              isCongestionCritical
                ? 'bg-rose-500/20 text-rose-400'
                : isCongestionHigh
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            <Flame className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
            {metrics.congestionScore !== undefined ? metrics.congestionScore.toFixed(1) : metrics.congestionRisk}
          </span>
          <span className="text-sm font-semibold text-slate-400 font-mono">/ 100</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wider uppercase ${
              isCongestionCritical
                ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                : isCongestionHigh
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                : metrics.congestionRisk >= 50
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
            }`}
          >
            {isCongestionCritical ? 'CRITICAL RISK' : isCongestionHigh ? 'HIGH RISK' : metrics.congestionRisk >= 50 ? 'MODERATE' : 'NORMAL'}
          </span>
        </div>

        {/* Trend indicator */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs">
          <div className="flex items-center gap-1">
            {congestionDelta >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-rose-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span className={congestionDelta >= 0 ? 'text-rose-300 font-medium' : 'text-emerald-300 font-medium'}>
              {congestionDelta >= 0 ? `↑ ${Math.abs(congestionDelta)}` : `↓ ${Math.abs(congestionDelta)}`}
            </span>
            <span className="text-slate-400">pts vs previous hour</span>
          </div>
          {surgeActive && (
            <span className="text-[10px] font-semibold text-rose-400 animate-pulse">SURGE ACTIVE</span>
          )}
        </div>
      </div>

      {/* KPI CARD 2 — CURRENT WAIT TIME */}
      <div
        id="kpi-current-wait-time"
        className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-4.5 shadow-lg shadow-slate-950/40"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
            Current Wait Time
          </span>
          <div className="rounded-full bg-blue-500/20 p-1.5 text-blue-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
            {metrics.averageWaitTime}
          </span>
          <span className="text-sm font-medium text-slate-300">min</span>
          <span className="text-xs text-slate-400">Average ED wait</span>
        </div>

        {/* Trend indicator */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs">
          <div className="flex items-center gap-1">
            {waitDelta >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span className={waitDelta >= 0 ? 'text-amber-300 font-medium' : 'text-emerald-300 font-medium'}>
              {waitDelta >= 0 ? `↑ ${waitDelta} min` : `↓ ${Math.abs(waitDelta)} min`}
            </span>
            <span className="text-slate-400">vs previous hour</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Triage P3-P5
          </span>
        </div>
      </div>

      {/* KPI CARD 3 — AVAILABLE BEDS */}
      <div
        id="kpi-available-beds"
        className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-4.5 shadow-lg shadow-slate-950/40"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
            Available Beds
          </span>
          <div
            className={`rounded-full p-1.5 ${
              metrics.bedsAvailable <= 5 ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            <Bed className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span
            className={`text-3xl font-extrabold tracking-tight font-mono ${
              metrics.bedsAvailable <= 5 ? 'text-rose-400' : 'text-white'
            }`}
          >
            {metrics.bedsAvailable}
          </span>
          <span className="text-xs text-slate-400">Available ED beds</span>
        </div>

        {/* Occupancy Indicator */}
        <div className="mt-3 border-t border-slate-800/80 pt-2.5 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-medium">
            <span>
              {metrics.bedsOccupied} / {metrics.bedsTotal} occupied
            </span>
            <span className={occupancyPercentage >= 88 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
              {occupancyPercentage}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                occupancyPercentage >= 90
                  ? 'bg-rose-500'
                  : occupancyPercentage >= 80
                  ? 'bg-amber-400'
                  : 'bg-cyan-500'
              }`}
              style={{ width: `${occupancyPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPI CARD 4 — PATIENT ARRIVALS */}
      <div
        id="kpi-patient-arrivals"
        className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 p-4.5 shadow-lg shadow-slate-950/40"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
            Patient Arrivals
          </span>
          <div className="rounded-full bg-emerald-500/20 p-1.5 text-emerald-400">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
            {metrics.patientsArrived}
          </span>
          <span className="text-sm font-medium text-slate-300">/ hour</span>
          <span className="text-xs text-slate-400">Current arrival rate</span>
        </div>

        {/* Baseline comparison */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs">
          <div className="flex items-center gap-1">
            <span
              className={`font-semibold ${
                arrivalDeltaFromBaseline > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {arrivalPercentAboveBaseline >= 0 ? `+${arrivalPercentAboveBaseline}%` : `${arrivalPercentAboveBaseline}%`}
            </span>
            <span className="text-slate-400">vs normal ({metrics.arrivalBaseline}/hr)</span>
          </div>
          <span className="text-[11px] text-cyan-400 font-medium">
            EMS: {metrics.ambulanceArrivals}
          </span>
        </div>
      </div>

      {/* SECONDARY OPERATIONAL SNAPSHOT ROW (Real API Metrics) */}
      <div className="col-span-1 sm:col-span-2 lg:col-span-4 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80">
          <div className="px-2 py-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Patients Waiting</span>
            <span className="text-lg font-bold font-mono text-cyan-400">{metrics.patientsWaiting}</span>
            <span className="text-[10px] text-slate-500 block">in queue</span>
          </div>
          <div className="px-2 py-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Patients Treated</span>
            <span className="text-lg font-bold font-mono text-white">{metrics.patientsTreated}</span>
            <span className="text-[10px] text-slate-500 block">throughput</span>
          </div>
          <div className="px-2 py-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Bed Occupancy</span>
            <span className="text-lg font-bold font-mono text-amber-400">
              {(metrics.bedOccupancyRate !== undefined ? metrics.bedOccupancyRate * 100 : occupancyPercentage).toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-500 block">{metrics.bedsOccupied} / {metrics.bedsTotal} beds</span>
          </div>
          <div className="px-2 py-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Congestion Score</span>
            <span className="text-lg font-bold font-mono text-cyan-400">
              {metrics.congestionScore !== undefined ? metrics.congestionScore.toFixed(1) : metrics.congestionRisk}
              <span className="text-xs text-slate-400 font-normal"> / 100</span>
            </span>
            <span className="text-[10px] text-slate-500 block">composite index</span>
          </div>
          <div className="px-2 py-1 col-span-2 sm:col-span-1">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 block font-semibold">Staff Capacity</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {(metrics.staffCapacityScore !== undefined ? metrics.staffCapacityScore * 100 : (metrics.staffNurses / metrics.staffNursesTotal) * 100).toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-500 block">{metrics.staffDoctors} Drs / {metrics.staffNurses} RNs</span>
          </div>
        </div>
      </div>
    </div>
  );
};
