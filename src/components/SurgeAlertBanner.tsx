import React from 'react';
import { AlertOctagon, Zap, ArrowUpRight, X } from 'lucide-react';

interface SurgeAlertBannerProps {
  surgeActive: boolean;
  onDeactivate: () => void;
  onGoToSimulator: () => void;
}

export const SurgeAlertBanner: React.FC<SurgeAlertBannerProps> = ({
  surgeActive,
  onDeactivate,
  onGoToSimulator,
}) => {
  if (!surgeActive) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 p-4 shadow-xl shadow-rose-950/50">
      {/* Background Pulse Accent */}
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-rose-500/10 blur-2xl" />

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-bounce">
            <Zap className="h-6 w-6 fill-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                EMERGENCY SURGE PROTOCOL ACTIVE
              </span>
              <span className="text-xs font-mono text-rose-300">
                Inflow: +60% | Beds: -30% | Queue: +45%
              </span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-slate-200">
              System detected rapid casualty accumulation. Congestion risk spiked to 95% with wait times exceeding 74 minutes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={onGoToSimulator}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-cyan-500"
          >
            <span>Test Relief in Simulator</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDeactivate}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
};
