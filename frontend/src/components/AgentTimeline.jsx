import React, { useState } from 'react';
import {
  Brain,
  Code2,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Clock,
  RotateCcw,
  ChevronDown,
  Activity,
  Check,
  AlertCircle
} from 'lucide-react';

const NODE_CONFIG = {
  recall_node: {
    icon: Brain,
    color: "teal",
    label: "Team Memory Recall",
    agent: "Memory Agent (Hindsight Cloud)"
  },
  analysis_node: {
    icon: Code2,
    color: "violet",
    label: "Analysis Agent",
    agent: "Code & Convention Inspector"
  },
  fix_node: {
    icon: Sparkles,
    color: "indigo",
    label: "Fix Agent",
    agent: "Diff & Code Synthesis Engine"
  },
  validation_node: {
    icon: CheckCircle2,
    color: "emerald",
    label: "Validation Agent",
    agent: "AST Syntax & Integrity Loop"
  },
  security_node: {
    icon: ShieldCheck,
    color: "rose",
    label: "Security Agent",
    agent: "Vulnerability & Secrets Audit"
  },
  final_review_node: {
    icon: Layers,
    color: "sky",
    label: "Final Review Agent",
    agent: "Synthesis & Packaging"
  }
};

export default function AgentTimeline({ timeline = [], isReviewing = false }) {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  const toggleStep = (stepId) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const totalDuration = timeline.reduce((acc, step) => acc + (step.duration_ms || 0), 0);
  const retriedStep = timeline.find((s) => s.status === "retrying" || (s.details && s.details.iteration > 1));

  if (!timeline || timeline.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
        <Activity size={32} className="mb-2 text-slate-600" />
        <h4 className="text-sm font-bold text-slate-300">LangGraph Pipeline Idle</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Click Review Code to observe the multi-agent orchestration lifecycle across all 6 specialized nodes.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden text-xs">
      {/* 1. Orchestration Header Summary */}
      <div className="p-2.5 bg-[#0c101a] border-b border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="badge badge-sm bg-violet-500/20 text-violet-300 border-violet-500/40 text-[10px] font-bold py-1">
            LangGraph StateGraph
          </span>
          <span className="text-[11px] font-semibold text-slate-300">
            {timeline.length} Execution Steps
          </span>
          {retriedStep && (
            <span className="badge badge-sm bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
              <RotateCcw size={10} className="text-amber-400" />
              <span>Retry Loop Activated</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
          <Clock size={12} className="text-slate-500" />
          <span>{totalDuration}ms total</span>
        </div>
      </div>

      {/* 2. Timeline List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#07090e]">
        {timeline.map((step, idx) => {
          const config = NODE_CONFIG[step.node_name] || {
            icon: Activity,
            color: "slate",
            label: step.node_name,
            agent: "Engineering Agent"
          };
          const Icon = config.icon;
          const isExpanded = expandedSteps.has(step.step_id || idx);
          const hasDetails = step.details && Object.keys(step.details).length > 0;
          const isRetry = step.status === "retrying" || (step.details && step.details.iteration > 1);

          return (
            <div
              key={step.step_id || idx}
              className={`rounded-lg border p-3 transition-all ${
                isRetry
                  ? "bg-[#14100c] border-amber-500/40"
                  : step.status === "failed"
                  ? "bg-[#140c0e] border-rose-500/40"
                  : "bg-[#0b0e17] border-white/[0.07]"
              }`}
            >
              {/* Step Title Row */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                      config.color === "teal"
                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                        : config.color === "violet"
                        ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                        : config.color === "indigo"
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : config.color === "emerald"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : config.color === "rose"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                    }`}
                  >
                    <Icon size={13} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-slate-100 text-[12px]">{step.title}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ({config.agent})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {step.duration_ms !== undefined && (
                    <span className="text-[10.5px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-white/[0.05]">
                      {step.duration_ms}ms
                    </span>
                  )}
                  {isRetry ? (
                    <span className="badge badge-xs bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-bold">
                      RETRY
                    </span>
                  ) : (
                    <span className="badge badge-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-bold">
                      DONE
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-[11.5px] text-slate-300 ml-8 leading-snug">
                {step.description}
              </p>

              {/* Expandable Details Section */}
              {hasDetails && (
                <div className="ml-8 mt-2 pt-1.5 border-t border-white/[0.04]">
                  <button
                    onClick={() => toggleStep(step.step_id || idx)}
                    className="text-[10.5px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                  >
                    <span>{isExpanded ? "Hide Execution State" : "Inspect State Payload"}</span>
                    <ChevronDown size={11} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <pre className="mt-1.5 p-2 bg-[#06080e] rounded border border-white/[0.05] text-[10.5px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(step.details, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
