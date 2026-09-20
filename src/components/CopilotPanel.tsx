import React, { useState, useRef, useEffect } from 'react';
import { HospitalMetrics, CopilotMessage, ForecastPoint, OperationalBottleneck, Recommendation } from '../types';
import { buildOperationalContext, generateGroundedAnswer } from '../services/copilotService';
import { Bot, Send, Sparkles, X, User, ShieldAlert, RefreshCw, Compass } from 'lucide-react';

interface CopilotPanelProps {
  metrics: HospitalMetrics;
  surgeActive: boolean;
  forecast?: ForecastPoint[];
  bottleneck?: OperationalBottleneck;
  recommendations?: Recommendation[];
  isOpen?: boolean;
  onClose?: () => void;
  isDrawer?: boolean;
  messages?: CopilotMessage[];
  setMessages?: React.Dispatch<React.SetStateAction<CopilotMessage[]>>;
  onResetConversation?: () => void;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({
  metrics,
  surgeActive,
  forecast,
  bottleneck,
  recommendations,
  isOpen = true,
  onClose,
  isDrawer = false,
  messages: propMessages,
  setMessages: propSetMessages,
  onResetConversation,
}) => {
  const [internalMessages, setInternalMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello, Operations Team. I am the ER-AEGIS Operational Copilot.
Current status: Congestion risk is at ${metrics.congestionRisk}% with ${metrics.averageWaitTime} min average wait and ${metrics.bedsAvailable} available beds.

Ask me specific operational questions regarding why congestion is changing, historical comparisons, resource counts, forecast projections, bottlenecks, or what-if scenarios.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: ['Real-time ED Telemetry', 'Capacity Forecast Model'],
      intent: 'CURRENT_STATUS',
    },
  ]);

  const messages = propMessages ?? internalMessages;
  const setMessages = propSetMessages ?? setInternalMessages;

  const handleResetChat = () => {
    if (onResetConversation) {
      onResetConversation();
    } else {
      setInternalMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hello, Operations Team. I am the ER-AEGIS Operational Copilot.
Current status: Congestion risk is at ${metrics.congestionRisk}% with ${metrics.averageWaitTime} min average wait and ${metrics.bedsAvailable} available beds.

Ask me specific operational questions regarding why congestion is changing, historical comparisons, resource counts, forecast projections, bottlenecks, or what-if scenarios.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: ['Real-time ED Telemetry', 'Capacity Forecast Model'],
          intent: 'CURRENT_STATUS',
        },
      ]);
    }
  };

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    'Why is congestion increasing?',
    'What does the ML model predict?',
    'What changed in the last hour?',
    'Is today worse than yesterday?',
    'What is causing the current delay?',
    'What will happen in the next hour?',
    'What is the biggest bottleneck?',
    'What should we prepare for?',
    'What happens if arrivals increase by 30%?',
    'How many beds are available?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMessage: CopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    // Build structured data context object reflecting live hospital state
    const operationalContext = buildOperationalContext(
      metrics,
      surgeActive,
      forecast,
      bottleneck,
      recommendations
    );

    // Extract prior conversational turns excluding the generic welcome message
    const conversationHistory = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content,
        intent: m.intent,
      }));

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          context: operationalContext,
          stateSnapshot: {
            congestionRisk: metrics.congestionRisk,
            averageWaitTime: metrics.averageWaitTime,
            bedsAvailable: metrics.bedsAvailable,
            bedsOccupied: metrics.bedsOccupied,
            bedsTotal: metrics.bedsTotal,
            patientsWaiting: metrics.patientsWaiting,
            patientsArrived: metrics.patientsArrived,
            ambulanceArrivals: metrics.ambulanceArrivals,
            ambulanceIncoming: metrics.ambulanceIncoming,
            staffDoctors: metrics.staffDoctors,
            staffNurses: metrics.staffNurses,
            surgeActive,
          },
          history: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: CopilotMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: [
          data.source === 'gemini-3.8-flash'
            ? 'Gemini 3.8 Flash (Grounded)'
            : data.source === 'gemini-3.1-flash-lite'
            ? 'Gemini 3.1 Flash-Lite (Grounded)'
            : 'AEGIS Operations Engine',
        ],
        intent: data.intent,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      // Data-grounded local fallback directly using operational context and conversation history
      const localResult = generateGroundedAnswer(queryText, operationalContext, conversationHistory);
      const fallbackMessage: CopilotMessage = {
        id: `fallback-${Date.now()}`,
        role: 'assistant',
        content: localResult.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: localResult.sources,
        intent: localResult.intent,
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatIntentLabel = (intent?: string) => {
    if (!intent) return null;
    switch (intent) {
      case 'CAUSE_ANALYSIS':
        return 'Cause Analysis';
      case 'CURRENT_STATUS':
        return 'Current Status';
      case 'HISTORICAL_COMPARISON':
        return 'Historical Comparison';
      case 'FORECAST':
        return 'Forecast Projection';
      case 'RESOURCE_STATUS':
        return 'Resource Status';
      case 'AMBULANCE_ANALYSIS':
        return 'Ambulance & EMS Analysis';
      case 'BOTTLENECK_ANALYSIS':
        return 'Bottleneck Analysis';
      case 'RECOMMENDATION':
        return 'Operational Priorities';
      case 'WHAT_IF':
        return 'What-If Simulation';
      case 'TREND_ANALYSIS':
        return 'Trend Analysis';
      case 'ALERT_EXPLANATION':
        return 'Alert Explanation';
      case 'GENERAL_OPERATIONAL_ANALYSIS':
        return 'Operational Analysis';
      case 'UNRELATED':
        return 'Scope Notice';
      default:
        return 'Operational Intel';
    }
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/20">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold tracking-tight text-white">ER-AEGIS Copilot</h2>
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-300">
                Grounded Ops Intel
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Question-aware capacity reasoning & data-backed answers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.some((m) => m.id !== 'welcome') && (
            <>
              <span className="hidden sm:inline-flex items-center rounded-full bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                Context: {messages.filter((m) => m.role === 'user').length} {messages.filter((m) => m.role === 'user').length === 1 ? 'turn' : 'turns'}
              </span>
              <button
                onClick={handleResetChat}
                title="Reset conversation session"
                className="flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </>
          )}

          {isDrawer && onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Suggested Questions Pills */}
      <div className="border-b border-slate-800/80 bg-slate-950/40 px-4 py-2.5 sm:px-5">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1">
            <Compass className="h-3 w-3 text-cyan-400" />
            Quick-Start Examples (Any operational question supported):
          </span>
          <span className="text-[9px] text-slate-500 font-normal">Click to try or type your own</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSendMessage(q)}
              disabled={isLoading}
              className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1 text-left text-[11px] text-slate-300 transition hover:border-cyan-500/50 hover:bg-slate-800 hover:text-cyan-200 active:scale-98 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 sm:p-5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-900/50 text-indigo-400 ring-1 ring-indigo-500/30">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs shadow-md ${
                  isUser
                    ? 'bg-cyan-600 text-white'
                    : 'border border-slate-800 bg-slate-950/90 text-slate-200'
                }`}
              >
                {!isUser && msg.intent && (
                  <div className="mb-1.5 flex items-center gap-1">
                    <span className="rounded bg-cyan-950/80 px-1.5 py-0.5 text-[9px] font-mono font-medium text-cyan-300 border border-cyan-800/40">
                      INTENT: {formatIntentLabel(msg.intent)}
                    </span>
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-1 text-[10px] text-slate-400">
                  <span>{msg.timestamp}</span>
                  {msg.sources && msg.sources.length > 0 && (
                    <span className="font-mono text-cyan-400/80">
                      {msg.sources.join(' • ')}
                    </span>
                  )}
                </div>
              </div>

              {isUser && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-900/50 text-cyan-300 ring-1 ring-cyan-500/30">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-cyan-400">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Analyzing operational telemetry & reasoning over metrics...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Safety Notice & Input Box */}
      <div className="border-t border-slate-800/80 bg-slate-950/70 p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputQuery);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask any question: 'Why are patients waiting so long?', 'Are we running low on beds?'..."
            disabled={isLoading}
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputQuery.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-md shadow-cyan-600/30 transition hover:bg-cyan-500 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
          <span>Operational decision support only. No medical diagnosis.</span>
          <span className="font-mono text-cyan-400/70">ER-AEGIS v2.4</span>
        </div>
      </div>
    </div>
  );

  if (isDrawer) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-900/98 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-200">
        {content}
      </div>
    );
  }

  return (
    <div className="h-[620px] rounded-xl border border-slate-800 bg-slate-900/90 shadow-lg shadow-slate-950/40">
      {content}
    </div>
  );
};
