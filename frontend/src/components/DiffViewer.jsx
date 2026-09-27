import React, { useState } from 'react';
import {
  Check,
  Copy,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Code2,
  FileCheck
} from 'lucide-react';

export default function DiffViewer({ proposedFix, onApplyFix, language = "python" }) {
  const [viewMode, setViewMode] = useState("diff"); // "diff" | "code"
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  if (!proposedFix) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
        <GitPullRequest size={32} className="mb-2 text-slate-600" />
        <h4 className="text-sm font-bold text-slate-300">No Fix Generated</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Run a review to have the Fix Agent generate a unified diff and replacement code.
        </p>
      </div>
    );
  }

  const {
    fixed_code = "",
    diff: rawDiff = "",
    unified_diff = "",
    explanation = "",
    validation_status = "passed",
    validation_checks = [],
    file_name = "code"
  } = proposedFix;
  const diff = rawDiff || unified_diff || "";

  const handleCopy = () => {
    const textToCopy = viewMode === "diff" ? diff : fixed_code;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (onApplyFix && fixed_code) {
      onApplyFix(fixed_code);
      setApplied(true);
      setTimeout(() => setApplied(false), 2500);
    }
  };

  const diffLines = (diff || "").split("\n");

  return (
    <div className="h-full flex flex-col overflow-hidden text-xs">
      {/* 1. Diff Actions Bar */}
      <div className="p-2.5 bg-[#0c101a] border-b border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Validation Status Badge */}
          {validation_status === "retried_and_fixed" ? (
            <span className="badge badge-sm bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold flex items-center gap-1 py-1">
              <RotateCcw size={10} className="animate-spin text-amber-400" />
              <span>Self-Corrected & Validated</span>
            </span>
          ) : validation_status === "warning" ? (
            <span className="badge badge-sm bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold flex items-center gap-1 py-1">
              <AlertTriangle size={10} />
              <span>Validation Warning</span>
            </span>
          ) : (
            <span className="badge badge-sm bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 py-1">
              <CheckCircle2 size={10} />
              <span>AST Syntax Validated</span>
            </span>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#101422] border border-white/[0.08] rounded p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode("diff")}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                viewMode === "diff"
                  ? "bg-violet-950/80 text-violet-200 border border-violet-500/40 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Unified Diff
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`px-2 py-0.5 rounded font-medium transition-all ${
                viewMode === "code"
                  ? "bg-violet-950/80 text-violet-200 border border-violet-500/40 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Fixed Code
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="btn btn-xs h-6 min-h-0 bg-[#121624] hover:bg-[#1a2034] text-slate-300 border border-white/[0.08] rounded text-[11px] font-medium flex items-center gap-1"
            title="Copy to clipboard"
          >
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={handleApply}
            className="btn btn-xs h-6 min-h-0 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white font-semibold border-none rounded text-[11px] flex items-center gap-1 shadow-sm"
            title="Replace code in left editor with this verified fix"
          >
            {applied ? (
              <>
                <FileCheck size={11} className="text-white" />
                <span>Applied to Editor!</span>
              </>
            ) : (
              <>
                <Sparkles size={11} />
                <span>Apply to Editor</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Rationale & Validation Summary Box */}
      <div className="p-3 bg-[#0a0d15] border-b border-white/[0.06] shrink-0 space-y-2">
        {explanation && (
          <div className="text-slate-300 leading-relaxed font-sans text-[11.5px]">
            <span className="font-bold text-slate-200 block mb-0.5">Rationale & Remediation:</span>
            <p className="text-slate-400">{explanation}</p>
          </div>
        )}

        {validation_checks && validation_checks.length > 0 && (
          <div className="pt-1.5 border-t border-white/[0.04] flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Automated Checks:</span>
            {validation_checks.map((chk, idx) => (
              <span
                key={idx}
                className="text-[10px] font-mono bg-emerald-950/30 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1"
              >
                <Check size={9} className="text-emerald-400" />
                {chk}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. Diff or Full Code Body */}
      <div className="flex-1 overflow-auto bg-[#07090e] p-2 font-mono text-[11.5px] leading-relaxed select-text">
        {viewMode === "diff" ? (
          diffLines.length > 0 && diff.trim() ? (
            <div className="space-y-[1px]">
              {diffLines.map((line, idx) => {
                const isAdd = line.startsWith("+") && !line.startsWith("+++");
                const isDel = line.startsWith("-") && !line.startsWith("---");
                const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");

                return (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded flex items-start font-mono ${
                      isAdd
                        ? "bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500"
                        : isDel
                        ? "bg-rose-950/40 text-rose-300 border-l-2 border-rose-500"
                        : isHeader
                        ? "bg-violet-950/30 text-violet-300 font-semibold"
                        : "text-slate-400"
                    }`}
                  >
                    <span className="w-8 shrink-0 text-slate-600 select-none text-[10px] text-right pr-2">
                      {idx + 1}
                    </span>
                    <span className="w-4 shrink-0 font-bold select-none text-center">
                      {isAdd ? "+" : isDel ? "-" : isHeader ? "@" : " "}
                    </span>
                    <span className="whitespace-pre overflow-x-auto flex-1">
                      {line.startsWith("+") || line.startsWith("-") ? line.slice(1) : line}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400" />
              <p className="font-semibold text-slate-300">No code changes required.</p>
              <p className="text-[11px] mt-1 text-slate-500">The submitted code already aligns with team conventions.</p>
            </div>
          )
        ) : (
          <pre className="p-3 bg-[#0a0d14] rounded-lg border border-white/[0.06] text-emerald-200/90 whitespace-pre overflow-x-auto font-mono text-xs">
            {fixed_code}
          </pre>
        )}
      </div>
    </div>
  );
}
