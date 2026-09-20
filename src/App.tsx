import React, { useState, useEffect, useRef } from 'react';
import { useHospitalState } from './hooks/useHospitalState';
import { DashboardHeader } from './components/DashboardHeader';
import { MetricCardsGrid } from './components/MetricCard';
import { ForecastChart } from './components/ForecastChart';
import { RiskFactorsPanel } from './components/RiskFactorsPanel';
import { EarlyWarningPanel } from './components/EarlyWarningPanel';
import { ResourcePressurePanel } from './components/ResourcePressurePanel';
import { BottleneckPanel } from './components/BottleneckPanel';
import { RecommendationsPanel } from './components/RecommendationsPanel';
import { WhatIfSimulator } from './components/WhatIfSimulator';
import { CopilotPanel } from './components/CopilotPanel';
import { SurgeAlertBanner } from './components/SurgeAlertBanner';
import { EmergencyDisclaimer } from './components/EmergencyDisclaimer';
import { soundManager } from './utils/sound';
import { Bot, Sparkles, Activity, ShieldAlert, Sliders, Cpu, AlertTriangle, Loader2 } from 'lucide-react';
import { CopilotMessage } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('command-center');
  const [isCopilotDrawerOpen, setIsCopilotDrawerOpen] = useState<boolean>(false);
  const [isAlertMuted, setIsAlertMuted] = useState<boolean>(false);

  const {
    metrics,
    surgeActive,
    simulatedTime,
    isPaused,
    appliedIds,
    forecast,
    riskFactors,
    earlyWarning,
    bottleneck,
    recommendations,
    mlPrediction,
    mlSummary,
    isBackendConnected,
    isLoading,
    backendError,
    backendTimestamp,
    apiDashboard,
    apiAlerts,
    apiRecommendations,
    apiForecast,
    apiResources,
    apiHistory,
    toggleSurgeMode,
    applyRecommendation,
    resetToBaseline,
    tickManual,
    togglePause,
    refreshBackendData,
  } = useHospitalState();

  // Shared persistent conversational state across Drawer and Tab views
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello, Operations Team. I am the ER-AEGIS Operational Copilot connected to the real ML model backend.
Current status: Congestion risk is at ${metrics.congestionRisk}% with ${metrics.averageWaitTime} min average wait and ${metrics.bedsAvailable} available beds.

Ask me specific operational questions regarding why congestion is changing, historical comparisons, resource counts, forecast projections, bottlenecks, or what-if scenarios.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: ['Real-time ED Telemetry', 'Capacity Forecast Model (Random Forest)'],
      intent: 'CURRENT_STATUS',
    },
  ]);

  const handleResetCopilot = () => {
    setCopilotMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello, Operations Team. I am the ER-AEGIS Operational Copilot connected to the real ML model backend.
Current status: Congestion risk is at ${metrics.congestionRisk}% with ${metrics.averageWaitTime} min average wait and ${metrics.bedsAvailable} available beds.

Ask me specific operational questions regarding why congestion is changing, historical comparisons, resource counts, forecast projections, bottlenecks, or what-if scenarios.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: ['Real-time ED Telemetry', 'Capacity Forecast Model (Random Forest)'],
        intent: 'CURRENT_STATUS',
      },
    ]);
  };

  // Track previous surgeActive value to detect transition to true
  const prevSurgeActiveRef = useRef<boolean>(surgeActive);

  useEffect(() => {
    // Play browser-native alert sound when surgeActive transitions from false to true
    if (!prevSurgeActiveRef.current && surgeActive && !isAlertMuted) {
      soundManager.playSurgeAlertSound();
    }
    prevSurgeActiveRef.current = surgeActive;
  }, [surgeActive, isAlertMuted]);

  const handleToggleAlertMute = () => {
    setIsAlertMuted((prev) => {
      const next = !prev;
      soundManager.playToggleBlip(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white flex flex-col font-sans">
      {/* 1. TOP NAVIGATION & CONTROLS */}
      <DashboardHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        surgeActive={surgeActive}
        onToggleSurge={toggleSurgeMode}
        simulatedTime={simulatedTime}
        isPaused={isPaused}
        onTogglePause={togglePause}
        onManualTick={tickManual}
        onReset={resetToBaseline}
        onOpenCopilot={() => setIsCopilotDrawerOpen(true)}
        isAlertMuted={isAlertMuted}
        onToggleAlertMute={handleToggleAlertMute}
        backendTimestamp={backendTimestamp}
        isBackendConnected={isBackendConnected}
      />

      {/* MAIN CONTAINER */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* BACKEND UNAVAILABLE ERROR STATE */}
        {backendError && (
          <div className="rounded-xl border border-rose-500/60 bg-rose-950/40 p-4 text-rose-200 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0" />
              <div>
                <h3 className="font-bold text-white text-sm">ER-AEGIS backend unavailable</h3>
                <p className="text-xs text-rose-300/90 mt-0.5">
                  Unable to connect to the FastAPI backend service at http://localhost:8000. Real-time telemetry and ML predictions cannot currently be retrieved.
                </p>
              </div>
            </div>
            <button
              onClick={refreshBackendData}
              className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition shadow shrink-0"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {isLoading && !apiDashboard && !backendError && (
          <div className="rounded-xl border border-cyan-500/30 bg-slate-900/80 p-4 text-cyan-300 flex items-center gap-3 shadow-md">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold">
              Connecting to ER-AEGIS backend (http://localhost:8000) and fetching live operational telemetry & ML predictions...
            </span>
          </div>
        )}

        {/* SURGE MODE ACTIVE BANNER */}
        <SurgeAlertBanner
          surgeActive={surgeActive}
          onDeactivate={toggleSurgeMode}
          onGoToSimulator={() => setActiveTab('simulator')}
        />

        {/* AI CONGESTION FORECAST (ML PREDICTION FROM GET /api/dashboard) */}
        {apiDashboard?.prediction && (
          <div className="rounded-xl border border-cyan-500/40 bg-slate-900/90 p-4 shadow-lg shadow-cyan-950/20 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400 ring-1 ring-cyan-500/30">
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                    AI CONGESTION FORECAST
                  </div>
                  <div className="flex items-baseline gap-3 mt-0.5">
                    <span className="text-3xl font-extrabold font-mono text-white">
                      {Math.round(apiDashboard.prediction.congestion_probability * 100)}%
                    </span>
                    <span
                      className={`rounded px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                        apiDashboard.prediction.risk_level === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                          : apiDashboard.prediction.risk_level === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                          : apiDashboard.prediction.risk_level === 'MODERATE'
                          ? 'bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                      }`}
                    >
                      {apiDashboard.prediction.risk_level}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      • Next {apiDashboard.prediction.prediction_horizon_minutes} minutes
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5">
                  <span className="text-slate-400">High Congestion Predicted: </span>
                  <span className={`font-bold ${apiDashboard.prediction.predicted_congestion ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {apiDashboard.prediction.predicted_congestion ? 'YES (Surge Alert)' : 'NO (Nominal)'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-slate-400">
                  <span>Data Snapshot: </span>
                  <span className="text-cyan-300 font-semibold">{apiDashboard.timestamp}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: COMMAND CENTER (PRIMARY DASHBOARD) */}
        {activeTab === 'command-center' && (
          <div className="space-y-6">
            {/* 2. COMMAND CENTER KPI CARDS */}
            <section aria-label="Key Performance Indicators">
              <MetricCardsGrid metrics={metrics} surgeActive={surgeActive} />
            </section>

            {/* 5. EARLY WARNING PANEL */}
            <section aria-label="Early Warning Alerts">
              <EarlyWarningPanel alert={earlyWarning} alerts={apiAlerts} surgeActive={surgeActive} />
            </section>

            {/* TWO-COLUMN GRID: 3. CONGESTION FORECAST + 4. WHY IS RISK INCREASING? */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                {/* 3. CONGESTION FORECAST CHART */}
                <ForecastChart
                  forecastData={forecast}
                  surgeActive={surgeActive}
                  mlPrediction={mlPrediction}
                  historyRecords={apiHistory}
                />
              </div>
              <div className="lg:col-span-4">
                {/* 4. WHY IS RISK INCREASING PANEL */}
                <RiskFactorsPanel
                  factors={riskFactors}
                  surgeActive={surgeActive}
                  congestionRisk={metrics.congestionRisk}
                  operationalScore={metrics.congestionScore}
                  mlPrediction={mlPrediction}
                  metrics={metrics}
                />
              </div>
            </div>

            {/* 6. RESOURCE PRESSURE OVERVIEW */}
            <section aria-label="Hospital Resources Pressure">
              <ResourcePressurePanel metrics={metrics} resources={apiResources} surgeActive={surgeActive} />
            </section>

            {/* TWO-COLUMN GRID: 7. BOTTLENECK DETECTION + 8. AI RECOMMENDATIONS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5">
                {/* 7. CURRENT BOTTLENECK DETECTION */}
                <BottleneckPanel bottleneck={bottleneck} surgeActive={surgeActive} />
              </div>
              <div className="lg:col-span-7">
                {/* 8. AI OPERATIONS RECOMMENDATIONS */}
                <RecommendationsPanel
                  recommendations={recommendations}
                  onApplyRecommendation={applyRecommendation}
                  surgeActive={surgeActive}
                />
              </div>
            </div>

            {/* QUICK EMBEDDED WHAT-IF SIMULATOR TEASER / ACCORDION */}
            <section className="pt-2">
              <WhatIfSimulator metrics={metrics} surgeActive={surgeActive} mlPrediction={mlPrediction} />
            </section>
          </div>
        )}

        {/* TAB 2: FORECAST (DEEP DIVE) */}
        {activeTab === 'forecast' && (
          <div className="space-y-6">
            <ForecastChart
              forecastData={forecast}
              surgeActive={surgeActive}
              mlPrediction={mlPrediction}
              historyRecords={apiHistory}
            />
            <RiskFactorsPanel
              factors={riskFactors}
              surgeActive={surgeActive}
              congestionRisk={metrics.congestionRisk}
              operationalScore={metrics.congestionScore}
              mlPrediction={mlPrediction}
              metrics={metrics}
            />
          </div>
        )}

        {/* TAB 3: RESOURCES (DEEP DIVE) */}
        {activeTab === 'resources' && (
          <div className="space-y-6">
            <ResourcePressurePanel metrics={metrics} resources={apiResources} surgeActive={surgeActive} />
            <BottleneckPanel bottleneck={bottleneck} surgeActive={surgeActive} />
          </div>
        )}

        {/* TAB 4: ALERTS */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <EarlyWarningPanel alert={earlyWarning} alerts={apiAlerts} surgeActive={surgeActive} />
            <BottleneckPanel bottleneck={bottleneck} surgeActive={surgeActive} />
            <RecommendationsPanel
              recommendations={recommendations}
              onApplyRecommendation={applyRecommendation}
              surgeActive={surgeActive}
            />
          </div>
        )}

        {/* TAB 5: WHAT-IF SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <WhatIfSimulator metrics={metrics} surgeActive={surgeActive} mlPrediction={mlPrediction} />
          </div>
        )}

        {/* TAB 6: AI COPILOT */}
        {activeTab === 'copilot' && (
          <div className="space-y-6">
            <CopilotPanel
              metrics={metrics}
              surgeActive={surgeActive}
              forecast={forecast}
              bottleneck={bottleneck}
              recommendations={recommendations}
              isDrawer={false}
              messages={copilotMessages}
              setMessages={setCopilotMessages}
              onResetConversation={handleResetCopilot}
            />
          </div>
        )}
      </main>

      {/* FLOATING AI COPILOT LAUNCHER BUTTON */}
      {activeTab !== 'copilot' && (
        <button
          id="open-copilot-btn"
          onClick={() => setIsCopilotDrawerOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-cyan-500/25 ring-2 ring-cyan-400/40 transition-all hover:scale-105 active:scale-95"
        >
          <Bot className="h-4 w-4 animate-bounce" />
          <span>Ask Copilot</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* SLIDE-OVER COPILOT DRAWER (ACCESSIBLE ACROSS ANY SCREEN) */}
      <CopilotPanel
        metrics={metrics}
        surgeActive={surgeActive}
        forecast={forecast}
        bottleneck={bottleneck}
        recommendations={recommendations}
        isOpen={isCopilotDrawerOpen}
        onClose={() => setIsCopilotDrawerOpen(false)}
        isDrawer={true}
        messages={copilotMessages}
        setMessages={setCopilotMessages}
        onResetConversation={handleResetCopilot}
      />

      {/* SAFETY AND DISCLAIMER FOOTER */}
      <EmergencyDisclaimer />
    </div>
  );
}
