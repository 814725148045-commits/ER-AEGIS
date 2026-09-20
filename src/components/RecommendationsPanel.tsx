import React from 'react';
import { Recommendation } from '../types';
import { Sparkles, CheckCircle, ArrowRight, ShieldCheck, Database } from 'lucide-react';

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  onApplyRecommendation: (rec: Recommendation) => void;
  surgeActive: boolean;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  recommendations,
  onApplyRecommendation,
  surgeActive,
}) => {
  return (
    <div
      id="ai-recommendations-panel"
      className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400 ring-1 ring-emerald-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">
              AI Operations Recommendations
            </h2>
            <p className="text-[11px] text-slate-400">
              Prescriptive operational mitigation recommendations from GET /api/recommendations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-semibold text-cyan-400">Operational decision support</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {recommendations.length === 0 ? (
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-4 text-center">
            <CheckCircle className="h-5 w-5 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-slate-300">No active mitigation actions required</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              All ED resources, bed queues, and ML congestion predictions are within normal thresholds.
            </p>
          </div>
        ) : (
          recommendations.map((rec, index) => {
            const isApplied = rec.status === 'APPLIED';
            const isCritical = rec.priority === 'CRITICAL';

            return (
              <div
                key={rec.id}
                className={`flex flex-col justify-between gap-3 rounded-lg border p-4 transition-all sm:flex-row sm:items-center ${
                  isApplied
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : isCritical
                    ? 'border-slate-800 bg-slate-950/60 hover:border-rose-500/40'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                      isApplied
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                        : isCritical
                        ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/40'
                        : 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/40'
                    }`}
                  >
                    {isApplied ? '✓' : index + 1}
                  </span>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold tracking-tight text-white">
                        {rec.title}
                      </h3>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isCritical
                            ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                        }`}
                      >
                        {rec.priority}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                      {rec.reason}
                    </p>

                    {/* Supporting Evidence from backend */}
                    {rec.evidence && Object.keys(rec.evidence).length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-800/60">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                          <Database className="h-3 w-3 text-cyan-400" />
                          Evidence:
                        </span>
                        {Object.entries(rec.evidence).map(([key, val]) => (
                          <span
                            key={key}
                            className="rounded bg-slate-800/90 px-2 py-0.5 font-mono text-[10px] text-cyan-300 ring-1 ring-slate-700/60"
                          >
                            {key.replace(/_/g, ' ')}: <strong className="text-white">{typeof val === 'number' ? (val < 1 && val > 0 ? `${(val * 100).toFixed(1)}%` : val) : String(val)}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-400">
                      <span className="text-slate-400 font-normal">Expected impact:</span>
                      <span>{rec.expectedImpact}</span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex shrink-0 sm:self-center">
                  {isApplied ? (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/40">
                      <CheckCircle className="h-4 w-4" />
                      <span>ENACTED</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onApplyRecommendation(rec)}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-600/30 transition hover:bg-cyan-500 active:scale-95"
                    >
                      <span>Execute Action</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
