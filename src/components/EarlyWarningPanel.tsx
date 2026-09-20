import React from 'react';
import { EarlyWarningAlert } from '../types';
import { AlertItem } from '../services/api';
import { ShieldAlert, Timer, CheckCircle, AlertTriangle } from 'lucide-react';

interface EarlyWarningPanelProps {
  alert: EarlyWarningAlert;
  alerts?: AlertItem[];
  surgeActive: boolean;
}

export const EarlyWarningPanel: React.FC<EarlyWarningPanelProps> = ({ alert, alerts = [], surgeActive }) => {
  const activeAlerts = alerts.length > 0 ? alerts : [];
  const primaryAlert = activeAlerts.length > 0 ? activeAlerts[0] : null;
  const isCritical = (primaryAlert?.severity === 'CRITICAL') || alert.severity === 'CRITICAL' || surgeActive;
  const isElevated = (primaryAlert?.severity === 'HIGH' || primaryAlert?.severity === 'MODERATE') || alert.severity === 'HIGH' || alert.severity === 'ELEVATED';

  // If backend returns NO active alerts and not in surge
  if (activeAlerts.length === 0 && !surgeActive && alert.severity === 'NORMAL') {
    return (
      <div
        id="early-warning-panel"
        className="rounded-xl border border-slate-800 bg-slate-900/80 p-4.5 shadow-md flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 ring-1 ring-emerald-500/30">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                EARLY WARNING SYSTEM
              </span>
              <span className="text-xs text-slate-400 font-mono">Live Telemetry</span>
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5">
              SYSTEM STATUS NOMINAL — No Operational Warnings
            </h3>
            <p className="text-xs text-slate-400">
              All triage throughput, bed occupancies, and staffing ratios from /api/alerts are currently within safe limits.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-right font-mono text-xs text-slate-400">
          <div>Next Re-evaluation</div>
          <span className="text-cyan-300 font-semibold">15 seconds</span>
        </div>
      </div>
    );
  }

  return (
    <div
      id="early-warning-panel"
      className={`rounded-xl border p-5 shadow-lg transition-all ${
        isCritical
          ? 'border-rose-500/60 bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-900 shadow-rose-950/30'
          : isElevated
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 shadow-amber-950/20'
          : 'border-slate-800 bg-slate-900/90 shadow-slate-950/40'
      }`}
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        {/* Left Side: Warning Header & Core Information */}
        <div className="flex items-start gap-3.5">
          <div
            className={`rounded-xl p-2.5 shadow-md ${
              isCritical
                ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40'
                : 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
            }`}
          >
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  isCritical
                    ? 'bg-rose-500/30 text-rose-200 ring-1 ring-rose-400/50'
                    : 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40'
                }`}
              >
                EARLY WARNING SYSTEM
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {primaryAlert ? primaryAlert.type : alert.title}
              </span>
            </div>

            <h3 className="mt-1 text-lg font-bold tracking-tight text-white">
              {primaryAlert ? primaryAlert.message : alert.primaryPressure}
            </h3>

            {/* Active alerts badge list if multiple alerts returned */}
            {activeAlerts.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">Active Backend Alerts:</span>
                {activeAlerts.map((a) => (
                  <span
                    key={a.id}
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${
                      a.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                        : a.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                        : 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40'
                    }`}
                  >
                    {a.type} ({a.severity})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Recommended Preparation Window Pill */}
        <div className="flex flex-col sm:items-end">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3 shadow-inner">
            <div className="rounded-lg bg-cyan-500/10 p-1.5 text-cyan-400">
              <Timer className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Preparation Window
              </div>
              <div className="text-sm font-bold text-cyan-300 font-mono">
                {alert.preparationWindow || '20–30 minutes'}
              </div>
            </div>
          </div>
          <span className="mt-1.5 text-[10px] text-slate-400">
            Window before bed & triage queues compound
          </span>
        </div>
      </div>
    </div>
  );
};
