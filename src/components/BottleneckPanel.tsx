import React from 'react';
import { OperationalBottleneck } from '../types';
import { Filter, AlertCircle, ArrowUpRight, Gauge } from 'lucide-react';

interface BottleneckPanelProps {
  bottleneck: OperationalBottleneck;
  surgeActive: boolean;
}

export const BottleneckPanel: React.FC<BottleneckPanelProps> = ({ bottleneck, surgeActive }) => {
  const isCritical = bottleneck.impactLevel === 'CRITICAL' || surgeActive;

  return (
    <div
      id="bottleneck-panel"
      className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40"
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/15 p-1.5 text-amber-400 ring-1 ring-amber-500/30">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">Current Bottleneck</h2>
            <p className="text-[11px] text-slate-400">Primary operational flow constriction</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            Impact:{' '}
            <span
              className={`font-bold font-mono ${
                isCritical ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {bottleneck.impactLevel}
            </span>
          </div>
          <div className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            Confidence:{' '}
            <span className="font-bold font-mono text-emerald-400">
              {bottleneck.confidence}%
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {/* Identified Bottleneck Tag */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Primary Chokepoint:
          </span>
          <span className="rounded-md bg-rose-500/15 px-2.5 py-1 text-sm font-extrabold tracking-wide text-rose-300 ring-1 ring-rose-500/30">
            {bottleneck.name}
          </span>
        </div>

        {/* Narrative Operational Explanation */}
        <p className="mt-3 text-sm leading-relaxed text-slate-200">
          {bottleneck.description}
        </p>

        {/* Supporting Operational Metrics Grid */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[11px] uppercase font-semibold text-slate-400">
              Secondary Factor
            </div>
            <div className="mt-1 text-xs font-medium text-slate-300">
              {bottleneck.secondaryFactor}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[11px] uppercase font-semibold text-slate-400">
              Target Resolution Window
            </div>
            <div className="mt-1 text-xs font-medium text-cyan-300 font-mono">
              {bottleneck.projectedResolutionTime}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
