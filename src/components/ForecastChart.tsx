import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { ForecastPoint } from '../types';
import { HistoryRecord } from '../services/api';
import { Sparkles, CheckCircle2, ShieldAlert, Cpu, ChevronDown, ChevronUp, History, Info } from 'lucide-react';
import type { PredictionOutput } from '../ml/types';

interface ForecastChartProps {
  forecastData: ForecastPoint[];
  surgeActive: boolean;
  mlPrediction?: PredictionOutput | any;
  historyRecords?: HistoryRecord[];
}

type SeriesKey = 'congestion_score' | 'patients_waiting' | 'patients_arrived' | 'patients_treated' | 'beds_occupied' | 'average_wait_time';

export const ForecastChart: React.FC<ForecastChartProps> = ({
  forecastData,
  surgeActive,
  mlPrediction,
  historyRecords = [],
}) => {
  const [activeSeries, setActiveSeries] = useState<SeriesKey>('congestion_score');
  const [viewMode, setViewMode] = useState<'forecast' | 'history24h'>('forecast');
  const [showMLDrivers, setShowMLDrivers] = useState<boolean>(false);

  // Find projected peak
  const projectedPeak = forecastData.reduce((max, pt) => (pt.congestionRisk > max.congestionRisk ? pt : max), forecastData[0]);

  // Format 24-hour historical records if viewMode is 'history24h'
  const historical24hData = historyRecords.map((rec) => ({
    name: rec.timestamp.includes(' ') ? rec.timestamp.split(' ')[1] : rec.timestamp,
    time: rec.timestamp.includes(' ') ? rec.timestamp.split(' ')[1] : rec.timestamp,
    fullTimestamp: rec.timestamp,
    value: rec[activeSeries],
    congestion_score: rec.congestion_score,
    patients_waiting: rec.patients_waiting,
    patients_arrived: rec.patients_arrived,
    patients_treated: rec.patients_treated,
    beds_occupied: rec.beds_occupied,
    average_wait_time: rec.average_wait_time,
  }));

  // Format standard forecast data (observed telemetry + 60m supported AI forecast)
  const chartData = forecastData.map((pt) => {
    return {
      name: pt.timeLabel,
      time: pt.timeLabel,
      isHistorical: pt.isHistorical,
      // Historical observed data
      historicalValue: pt.isHistorical || pt.timeLabel.includes('Now') ? pt.congestionRisk : null,
      // Predicted future data (connecting from Now onwards)
      predictedValue: !pt.isHistorical || pt.timeLabel.includes('Now') ? pt.congestionRisk : null,
      upperBound: !pt.isHistorical ? pt.upperBound : null,
      lowerBound: !pt.isHistorical ? pt.lowerBound : null,
      predictedWaitTime: pt.predictedWaitTime,
      predictedBedDemand: pt.predictedBedDemand,
      confidence: pt.confidence,
    };
  });

  const seriesLabels: Record<SeriesKey, { label: string; unit: string; color: string }> = {
    congestion_score: { label: 'Congestion Score', unit: '%', color: '#06b6d4' },
    patients_waiting: { label: 'Patients Waiting', unit: ' queue', color: '#f59e0b' },
    patients_arrived: { label: 'Patients Arrived', unit: ' pts/interval', color: '#10b981' },
    patients_treated: { label: 'Patients Treated', unit: ' treated', color: '#8b5cf6' },
    beds_occupied: { label: 'Beds Occupied', unit: ' beds', color: '#f43f5e' },
    average_wait_time: { label: 'Average Wait Time', unit: ' min', color: '#ec4899' },
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      if (viewMode === 'history24h') {
        const item = payload[0].payload;
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur-md">
            <div className="border-b border-slate-800 pb-1.5 font-semibold text-slate-200">
              {item.fullTimestamp || label} (Historical Telemetry)
            </div>
            <div className="mt-2 space-y-1 font-mono">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Congestion Score:</span>
                <span className="font-bold text-cyan-400">{item.congestion_score?.toFixed(1)} / 100</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Average Wait:</span>
                <span className="text-amber-300">{item.average_wait_time?.toFixed(0)} min</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Beds Occupied:</span>
                <span className="text-slate-200">{item.beds_occupied} / 70</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Waiting Queue:</span>
                <span className="text-indigo-300">{item.patients_waiting}</span>
              </div>
            </div>
          </div>
        );
      }

      const data = payload[0].payload;
      const isNow = label.includes('Now');
      const isPast = data.isHistorical && !isNow;
      const val = data.predictedValue ?? data.historicalValue;

      return (
        <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
            <span className="font-semibold text-slate-200">{label}</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                isPast
                  ? 'bg-slate-800 text-slate-400'
                  : isNow
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-indigo-500/20 text-indigo-300'
              }`}
            >
              {isPast ? 'Historical Observed' : isNow ? 'Current Observed' : 'Supported 60m AI Forecast'}
            </span>
          </div>

          <div className="mt-2 space-y-1 font-mono">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">
                {isPast || isNow ? 'Operational Congestion Score:' : 'AI Congestion Probability:'}
              </span>
              <span className={`font-bold ${val >= 80 ? 'text-rose-400' : 'text-cyan-400'}`}>
                {isPast || isNow ? `${val} / 100` : `${val}%`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Projected Wait Time:</span>
              <span className="text-amber-300">{data.predictedWaitTime} min</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Projected Bed Demand:</span>
              <span className="text-slate-200">{data.predictedBedDemand} beds</span>
            </div>
            {!data.isHistorical && (
              <div className="flex items-center justify-between gap-4 border-t border-slate-800/80 pt-1 text-[11px]">
                <span className="text-slate-500">Supported Model Horizon:</span>
                <span className="text-emerald-400">60 Minutes</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg shadow-slate-950/40">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-white">
              ED Congestion Forecast & Operational History
            </h2>
            <span className="flex items-center gap-1 rounded bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300 ring-1 ring-indigo-500/30">
              <Sparkles className="h-3 w-3" />
              Supported 60m ML Horizon
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Real telemetry from GET /api/history & genuine 60-minute prediction from GET /api/forecast.
          </p>
        </div>

        {/* View mode toggle (Forecast vs 24h History) */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-800 bg-slate-950/70 p-1 text-xs">
            <button
              onClick={() => setViewMode('forecast')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                viewMode === 'forecast' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Recent + 60m Forecast
            </button>
            <button
              onClick={() => setViewMode('history24h')}
              className={`rounded px-2.5 py-1 font-medium transition ${
                viewMode === 'history24h' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              24h History (96 pts)
            </button>
          </div>
        </div>
      </div>

      {/* Series selection if in 24h history mode */}
      {viewMode === 'history24h' && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-3">
          <span className="text-[11px] text-slate-400 font-semibold mr-1">Select History Series:</span>
          {(Object.keys(seriesLabels) as SeriesKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActiveSeries(key)}
              className={`rounded px-2 py-1 text-xs font-mono transition ${
                activeSeries === key
                  ? 'bg-slate-800 text-cyan-300 ring-1 ring-cyan-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {seriesLabels[key].label}
            </button>
          ))}
        </div>
      )}

      {/* Forecast Legend Bar */}
      {viewMode === 'forecast' && (
        <div className="mt-4 flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm bg-cyan-500"></span>
              <span>Historical Observed (Past Telemetry)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-4 rounded-sm border border-dashed border-rose-400 bg-rose-500/30"></span>
              <span>Supported AI Forecast (+60 min only)</span>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="h-0.5 w-4 bg-amber-400"></span>
              <span>High Risk Threshold (80%)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
              Horizon: 60m ONLY
            </span>
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'history24h' ? (
            <LineChart data={historical24hData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} interval={7} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#334155' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={seriesLabels[activeSeries].color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="predictedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={surgeActive ? '#f43f5e' : '#ec4899'} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={surgeActive ? '#f43f5e' : '#8b5cf6'} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94a3b8"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
              />
              <Tooltip content={<CustomTooltip />} />

              <ReferenceLine
                y={80}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Elevated Risk (80%)',
                  fill: '#fbbf24',
                  fontSize: 10,
                  position: 'insideTopLeft',
                }}
              />

              {/* Historical Observed curve */}
              <Area
                type="monotone"
                dataKey="historicalValue"
                stroke="#06b6d4"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#historicalGradient)"
                connectNulls={false}
                isAnimationActive={false}
              />

              {/* Forecast Predicted curve (genuine 60-min horizon) */}
              <Area
                type="monotone"
                dataKey="predictedValue"
                stroke={surgeActive ? '#f43f5e' : '#ec4899'}
                strokeWidth={3}
                strokeDasharray="5 5"
                fillOpacity={1}
                fill="url(#predictedGradient)"
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Bottom Insights Footnote */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-cyan-400" />
          <span>
            {viewMode === 'history24h'
              ? 'Displaying 96 15-minute historical records from GET /api/history?limit=96.'
              : 'ER-AEGIS ML model is trained specifically for the 60-minute prediction horizon. No unsupported multi-hour horizons are fabricated.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-slate-400">
            Model Horizon: 60 Minutes (Scikit-Learn Random Forest)
          </span>
        </div>
      </div>
    </div>
  );
};
