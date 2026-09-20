import React from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  RotateCcw,
  Zap,
  Play,
  Pause,
  ChevronRight,
  ShieldCheck,
  Building2,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface DashboardHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  surgeActive: boolean;
  onToggleSurge: () => void;
  simulatedTime: Date;
  isPaused: boolean;
  onTogglePause: () => void;
  onManualTick: () => void;
  onReset: () => void;
  onOpenCopilot: () => void;
  isAlertMuted: boolean;
  onToggleAlertMute: () => void;
  backendTimestamp?: string | null;
  isBackendConnected?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  setActiveTab,
  surgeActive,
  onToggleSurge,
  simulatedTime,
  isPaused,
  onTogglePause,
  onManualTick,
  onReset,
  onOpenCopilot,
  isAlertMuted,
  onToggleAlertMute,
  backendTimestamp,
  isBackendConnected,
}) => {
  const formattedTime = simulatedTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const navItems = [
    { id: 'command-center', label: 'Command Center' },
    { id: 'forecast', label: 'Forecast' },
    { id: 'resources', label: 'Resources' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'simulator', label: 'What-If Simulator' },
    { id: 'copilot', label: 'AI Copilot' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      {/* Top Banner Row */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Left: Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Activity className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">ER-AEGIS</h1>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-400 ring-1 ring-cyan-500/30">
                v1.0-DEMO
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              Predict the pressure. Prepare before the overload.
            </p>
          </div>
        </div>

        {/* Right: Hospital Status & Operational Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Operational Status Badge */}
          <div
            className={`hidden items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium md:flex ${
              surgeActive
                ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                surgeActive ? 'animate-ping bg-rose-500' : 'animate-pulse bg-emerald-400'
              }`}
            />
            <span>{surgeActive ? 'SURGE STATUS ACTIVE' : 'SYSTEM OPERATIONAL'}</span>
          </div>

          {/* Simulated / Backend Time Display */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-slate-300">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-mono font-medium text-cyan-300">
              {backendTimestamp || formattedTime}
            </span>
            <span className="hidden text-[10px] text-slate-400 lg:inline">
              {backendTimestamp ? '(FASTAPI)' : '(SIM)'}
            </span>
            {isBackendConnected && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Connected to FastAPI backend" />
            )}
          </div>

          {/* Simulation Play/Pause & Step Buttons */}
          <div className="hidden items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-0.5 sm:flex">
            <button
              onClick={onTogglePause}
              title={isPaused ? 'Resume live simulation' : 'Pause simulation'}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onManualTick}
              title="Advance simulation by 2 min"
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onReset}
              title="Reset to baseline"
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* SYSTEM ALERTS SOUND MUTE/UNMUTE TOGGLE */}
          <button
            id="system-alert-audio-toggle"
            onClick={onToggleAlertMute}
            title={isAlertMuted ? 'Alert sounds muted (Click to enable audio notifications)' : 'Alert sounds active (Click to mute)'}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
              isAlertMuted
                ? 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                : 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300 ring-1 ring-cyan-500/20 hover:bg-cyan-900/40'
            }`}
          >
            {isAlertMuted ? (
              <>
                <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline">Muted</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                <span className="hidden sm:inline">Alert Audio</span>
              </>
            )}
          </button>

          {/* SURGE MODE TOGGLE (KEY HACKATHON DEMO FEATURE) */}
          <button
            id="surge-mode-toggle"
            onClick={onToggleSurge}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-md active:scale-95 ${
              surgeActive
                ? 'bg-rose-600 text-white shadow-rose-600/40 ring-2 ring-rose-400 hover:bg-rose-500 animate-pulse'
                : 'bg-slate-800 text-slate-300 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-500/40 border border-slate-700'
            }`}
          >
            <Zap className={`h-4 w-4 ${surgeActive ? 'text-yellow-300 fill-yellow-300' : 'text-slate-400'}`} />
            <span>{surgeActive ? 'DEACTIVATE SURGE' : 'SURGE MODE'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 py-1.5 sm:px-6 scrollbar-none">
        <nav className="flex items-center space-x-1 sm:space-x-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'copilot') {
                    onOpenCopilot();
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
