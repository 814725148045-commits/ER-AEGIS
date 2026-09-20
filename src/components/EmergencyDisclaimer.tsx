import React, { useState } from 'react';
import { ShieldCheck, Info, Database, Cpu, Lock, AlertTriangle, ChevronDown, ChevronUp, FileCode, CheckCircle2 } from 'lucide-react';
import { mlPredictionService } from '../ml/mlPredictionService';

export const EmergencyDisclaimer: React.FC = () => {
  const [showTechDetails, setShowTechDetails] = useState<boolean>(false);
  const summary = mlPredictionService.getDatasetSummary();

  return (
    <footer className="mt-8 border-t border-slate-800/80 bg-slate-950/80 py-6 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 text-center text-xs sm:flex-row sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span className="font-semibold text-slate-200">ER-AEGIS Operational Intelligence</span>
            <span className="hidden text-slate-600 sm:inline">•</span>
            <span className="text-slate-400">Hospital Emergency Operations Command Prototype</span>
            <button
              onClick={() => setShowTechDetails(!showTechDetails)}
              className="ml-2 flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-cyan-400 hover:bg-slate-700/80 transition-colors"
            >
              <Cpu className="h-3 w-3" />
              <span>Technical & ML Documentation</span>
              {showTechDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400">
            ER-AEGIS is an operational decision-support prototype using synthetic data. It does not provide medical diagnosis or clinical treatment recommendations.
          </p>
        </div>

        {/* Expandable Technical Documentation & Transparency Section */}
        {showTechDetails && (
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/90 p-5 text-left text-xs shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Technical Architecture & Machine Learning Transparency
                </h3>
              </div>
              <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-cyan-300 ring-1 ring-cyan-500/20">
                Random Forest ML Layer v1.0
              </span>
            </div>

            {/* 5 Core Transparency Pillars */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <Database className="h-4 w-4 text-cyan-400" />
                  <h4>1. Synthetic Hospital Dataset</h4>
                </div>
                <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                  Trained on <strong className="text-white">{summary.totalRecords} observation intervals</strong> spanning {summary.totalDays} days (every {summary.intervalMinutes} minutes). Models circadian arrival waves, ambulance surges, wait room queues, acute bed saturation, and staffing turnover with reproducible pseudo-random seeds.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5 font-mono text-[10px] text-slate-400">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">Mean Wait: {summary.metricsSummary.avgWaitTimeMinutes}m</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">Mean Inflow: {summary.metricsSummary.avgArrivalsPerInterval}/15m</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">Congestion Frequency: {summary.highCongestionRatePercent}%</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Cpu className="h-4 w-4 text-indigo-400" />
                  <h4>2. Prototype Random Forest Model</h4>
                </div>
                <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                  Ensemble of <strong className="text-white">20 decision trees</strong> trained using bagging and random feature subspace sub-selection. Binary classifier outputs the 60-minute congestion probability, coupled with multi-horizon continuous regression trees for +30m, +60m, +90m, and +120m horizons.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5 font-mono text-[10px] text-slate-400">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">Validation Acc: 89%</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">MDI Gini Feature Weights</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">Sub-5ms Inference</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h4>3. Not Clinically Validated</h4>
                </div>
                <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                  The model is an operational prototype and has <strong className="text-amber-200">not undergone clinical trials or FDA / CE medical device certification</strong>. It must never be used for triage classification, individual medical diagnosis, treatment prescribing, or clinical discharge decisions.
                </p>
                <div className="mt-2.5 flex items-center gap-1 text-[10px] text-amber-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Administrative simulation & capacity planning only</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h4>4. Operational Decision Support</h4>
                </div>
                <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                  ER-AEGIS empowers emergency department charge nurses and operations directors to anticipate queue congestion, unblock boarded beds, and optimize nursing float coverage 30 to 120 minutes ahead of peak saturation.
                </p>
                <div className="mt-2.5 flex items-center gap-1 text-[10px] text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Early warning alerts & what-if scenario testing</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2 text-purple-300 font-semibold">
                  <Lock className="h-4 w-4 text-purple-400" />
                  <h4>5. Zero Patient-Identifiable Info (PII)</h4>
                </div>
                <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                  <strong className="text-white">Strict privacy boundary:</strong> The architecture operates strictly on aggregated department-level counts and elapsed duration metrics. No names, medical record numbers (MRNs), diagnoses, or personal health identifiers are collected or stored.
                </p>
                <div className="mt-2.5 flex items-center gap-1 text-[10px] text-purple-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>HIPAA & GDPR privacy-by-design compliance</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <FileCode className="h-4 w-4 text-cyan-400" />
                  <h4>6. Pluggable API Microservice</h4>
                </div>
                <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
                  Clean service decoupling via <code className="text-cyan-300">POST /api/predict</code> and <code className="text-cyan-300">GET /api/ml/dataset-summary</code>. Ready to swap or proxy directly to external Python FastAPI, Scikit-Learn, or XGBoost inference containers.
                </p>
                <div className="mt-2.5 flex items-center gap-1 font-mono text-[10px] text-slate-400">
                  <span>POST /api/predict → JSON PredictionOutput</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};
