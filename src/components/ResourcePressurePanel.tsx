import React from 'react';
import { HospitalMetrics } from '../types';
import { ResourcesResponse } from '../services/api';
import { Bed, Users2, Stethoscope, Ambulance, ShieldAlert } from 'lucide-react';

interface ResourcePressurePanelProps {
  metrics: HospitalMetrics;
  resources?: ResourcesResponse | null;
  surgeActive: boolean;
}

export const ResourcePressurePanel: React.FC<ResourcePressurePanelProps> = ({
  metrics,
  resources,
  surgeActive,
}) => {
  // Use real backend values from GET /api/resources if available, otherwise metrics
  const bedsTotal = resources?.beds.total ?? metrics.bedsTotal;
  const bedsOccupied = resources?.beds.occupied ?? metrics.bedsOccupied;
  const bedsAvailable = resources?.beds.available ?? metrics.bedsAvailable;

  const staffDoctors = resources?.staff.doctors ?? metrics.staffDoctors;
  const staffNurses = resources?.staff.nurses ?? metrics.staffNurses;
  const staffSupport = resources?.staff.support_staff ?? metrics.staffSupport;

  const bedOccupancyPercent = Math.round((bedsOccupied / bedsTotal) * 100);
  const waitingPercent = Math.round((metrics.patientsWaiting / metrics.waitingCapacity) * 100);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-500/15 p-1.5 text-cyan-400 ring-1 ring-cyan-500/30">
            <Bed className="h-4 w-4" />
          </div>
          <h2 className="text-base font-bold tracking-tight text-white">Resource Pressure</h2>
          <span className="text-[11px] text-cyan-400/80 font-mono hidden sm:inline">(GET /api/resources)</span>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Capacity Alert Threshold: 85%
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* CARD 1: BEDS */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition-all hover:border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">Beds</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                bedsAvailable <= 5
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {bedsAvailable <= 5 ? 'DEFICIT RISK' : 'STABLE'}
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-white">
                {bedsAvailable}
              </span>
              <span className="ml-1 text-xs text-slate-400">available</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {bedsOccupied} / {bedsTotal} occupied
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  bedOccupancyPercent >= 90
                    ? 'bg-rose-500'
                    : bedOccupancyPercent >= 80
                    ? 'bg-amber-400'
                    : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, bedOccupancyPercent)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-400 font-mono">
              <span>{bedOccupancyPercent}% occupied</span>
              <span>{bedsTotal} total</span>
            </div>
          </div>
        </div>

        {/* CARD 2: STAFF */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition-all hover:border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">Active Staff</span>
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
              Shift Roster
            </span>
          </div>

          <div className="mt-2.5 space-y-2 text-xs">
            {/* Doctors */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Doctors</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-white">
                  {staffDoctors} active
                </span>
                <span className="text-[10px] text-slate-400">
                  ({metrics.staffDoctorsTotal} scheduled)
                </span>
              </div>
            </div>

            {/* Nurses */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Nurses</span>
              <div className="flex items-center gap-2">
                <span className={`font-mono font-semibold ${staffNurses / metrics.staffNursesTotal < 0.8 ? 'text-amber-400' : 'text-white'}`}>
                  {staffNurses} active
                </span>
                <span className="text-[10px] text-slate-400">
                  ({metrics.staffNursesTotal} scheduled)
                </span>
              </div>
            </div>

            {/* Support */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Support staff</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-white">
                  {staffSupport} active
                </span>
                <span className="text-[10px] text-slate-400">
                  ({metrics.staffSupportTotal} scheduled)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3: WAITING AREA */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition-all hover:border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">Waiting Area</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                waitingPercent >= 85 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {waitingPercent >= 85 ? 'HIGH DENSITY' : 'NORMAL'}
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-white">
                {metrics.patientsWaiting}
              </span>
              <span className="ml-1 text-xs text-slate-400">patients</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Capacity: {metrics.waitingCapacity}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  waitingPercent >= 90
                    ? 'bg-rose-500'
                    : waitingPercent >= 75
                    ? 'bg-amber-400'
                    : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, waitingPercent)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-400 font-mono">
              <span>{waitingPercent}% seating used</span>
              <span>{Math.max(0, metrics.waitingCapacity - metrics.patientsWaiting)} open</span>
            </div>
          </div>
        </div>

        {/* CARD 4: AMBULANCES */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition-all hover:border-slate-700">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-slate-400">Ambulances</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                metrics.ambulanceIncoming > metrics.ambulanceBaysAvailable
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {metrics.ambulanceIncoming > metrics.ambulanceBaysAvailable ? 'BAY DEFICIT' : 'BAYS READY'}
            </span>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-bold font-mono text-amber-400">
                {metrics.ambulanceIncoming}
              </span>
              <span className="ml-1 text-xs text-slate-400">incoming</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold font-mono text-white">
                {metrics.ambulanceBaysAvailable} / {metrics.ambulanceBaysTotal}
              </span>
              <div className="text-[10px] text-slate-400">available bays</div>
            </div>
          </div>

          {/* Bay Status indicator circles */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-400">
            <span>Bay Offload Queue:</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: metrics.ambulanceBaysTotal }).map((_, idx) => {
                const isOccupied = idx >= metrics.ambulanceBaysAvailable;
                return (
                  <span
                    key={idx}
                    title={isOccupied ? 'Bay Occupied' : 'Bay Available'}
                    className={`h-2.5 w-2.5 rounded-full ${
                      isOccupied ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
