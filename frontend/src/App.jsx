import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import confetti from 'canvas-confetti';
import {
  Brain,
  Code2,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  Search,
  X,
  Layers,
  Trash2,
  BookOpen,
  ArrowRight
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { id: "auto", label: "✨ Auto-Detect (Any Language)" },
  { id: "python", label: "Python" },
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "sql", label: "SQL" },
  { id: "shell", label: "Bash / Shell" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" }
];

export default function App() {
  const [code, setCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);

  const [memories, setMemories] = useState([]);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
  const [isMemoryDrawerOpen, setIsMemoryDrawerOpen] = useState(false);
  const [memorySearch, setMemorySearch] = useState("");
  
  const [acceptedFindings, setAcceptedFindings] = useState(new Set());
  const [rejectedFindings, setRejectedFindings] = useState(new Set());
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setIsMemoriesLoading(true);
    try {
      const res = await fetch('/api/memory/list');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setIsMemoriesLoading(false);
    }
  };

  const handleReview = async () => {
    if (!code.trim()) {
      alert("Please paste or write some code to review.");
      return;
    }

    setIsReviewing(true);
    setReviewResult(null);

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: selectedLanguage,
          bypass_memory: !memoryEnabled
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReviewResult(data);
        if (data.detected_language) {
          setDetectedLanguage(data.detected_language);
        }
      } else {
        alert("Review failed. Please check server logs.");
      }
    } catch (err) {
      alert(`Error calling review service: ${err.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleDecision = async (finding, decision) => {
    try {
      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding_title: finding.title,
          finding_category: finding.category,
          finding_description: finding.description,
          decision,
          feedback_rule: `Team Convention [${finding.category}]: ${finding.title}. ${finding.description}`
        })
      });

      if (res.ok) {
        if (decision === 'accept') {
          setAcceptedFindings((prev) => new Set(prev).add(finding.id));
          confetti({
            particleCount: 70,
            spread: 50,
            origin: { y: 0.6 }
          });
        } else {
          setRejectedFindings((prev) => new Set(prev).add(finding.id));
        }
        setTimeout(fetchMemories, 600);
      }
    } catch (err) {
      alert(`Failed to save decision: ${err.message}`);
    }
  };

  const handleResetBank = async () => {
    if (!window.confirm("Are you sure you want to clear all team memories for a fresh start?")) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/memory/reset', { method: 'POST' });
      if (res.ok) {
        setMemories([]);
        setAcceptedFindings(new Set());
        setRejectedFindings(new Set());
        setReviewResult(null);
      }
    } catch (err) {
      alert("Failed to reset memory bank.");
    } finally {
      setIsResetting(false);
    }
  };

  const filteredMemories = memories.filter(m =>
    (m.text || "").toLowerCase().includes(memorySearch.toLowerCase()) ||
    (m.fact_type || "").toLowerCase().includes(memorySearch.toLowerCase())
  );

  const getMonacoLang = () => {
    if (selectedLanguage !== "auto") return selectedLanguage;
    if (detectedLanguage && detectedLanguage !== "plaintext") return detectedLanguage;
    return "python";
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#090d16] text-slate-100 font-sans select-none">
      {/* Sleek, High-Contrast Minimalist Navbar */}
      <header className="h-14 min-h-[56px] w-full bg-[#0c101d] border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between z-30 shrink-0 shadow-lg shadow-black/50">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-violet-500/25">
            <Brain size={18} />
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
              Codebase Memory
            </h1>
            <span className="hidden md:inline-block text-[11px] font-medium text-slate-400 border-l border-slate-700/80 pl-2.5 leading-none">
              AI Code Review • Persistent Team Memory
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Memory Layer Toggle */}
          <div
            onClick={() => setMemoryEnabled(!memoryEnabled)}
            className="flex items-center gap-2 bg-[#121829] hover:bg-[#182035] border border-slate-700/80 rounded-full px-3 py-1 text-xs cursor-pointer transition-colors shadow-sm"
            title="Click to toggle Hindsight team memory on or off"
          >
            <div className={`w-2 h-2 rounded-full ${memoryEnabled ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-500'}`} />
            <span className="text-slate-400 hidden sm:inline text-[11px] font-medium">Memory Layer:</span>
            <span className={`text-[11px] font-bold ${memoryEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
              {memoryEnabled ? 'ACTIVE' : 'OFF'}
            </span>
          </div>

          {/* Stored Team Memories Trigger */}
          <button
            onClick={() => setIsMemoryDrawerOpen(true)}
            className="btn btn-sm h-8 min-h-0 bg-[#141b2d] hover:bg-[#1c263f] text-slate-200 border-slate-700/80 rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm"
          >
            <BookOpen size={14} className="text-emerald-400" />
            <span className="hidden xs:inline">Team Memories</span>
            <span className="badge badge-sm badge-success text-[10px] font-extrabold px-1.5 py-0.5">
              {memories.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Full-Width Edge-to-Edge Workspace (Zero Gutters) */}
      <main className="flex-1 w-full h-[calc(100vh-56px)] flex flex-col lg:flex-row overflow-hidden">
        {/* Left Half: Code Input & Monaco Editor */}
        <section className="w-full lg:w-1/2 h-full flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-[#090d16] overflow-hidden">
          {/* Editor Sub-Header Toolbar */}
          <div className="h-11 min-h-[44px] bg-[#0c101d] border-b border-slate-800/80 px-4 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Code2 size={16} className="text-violet-400 shrink-0" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="select select-bordered select-xs bg-[#121829] text-slate-200 border-slate-700/80 text-xs rounded-md focus:outline-none focus:border-violet-500 font-medium"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>

              {detectedLanguage && selectedLanguage === "auto" && (
                <span className="badge badge-xs bg-violet-950/60 border border-violet-500/50 text-violet-300 text-[10px] font-mono font-bold tracking-wider px-2 py-1 uppercase">
                  Detected: {detectedLanguage}
                </span>
              )}
            </div>

            {code && (
              <button
                onClick={() => { setCode(""); setReviewResult(null); }}
                className="btn btn-ghost btn-xs text-slate-400 hover:text-slate-100 flex items-center gap-1 font-medium"
                title="Clear code"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Monaco Code Editor Stretched Edge-to-Edge */}
          <div className="flex-1 w-full h-full relative overflow-hidden bg-[#090d16]">
            <Editor
              height="100%"
              width="100%"
              language={getMonacoLang()}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                fontSize: 13.5,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                backgroundColor: "#090d16"
              }}
            />
          </div>

          {/* Editor Action Bottom Bar */}
          <div className="h-12 min-h-[48px] bg-[#0c101d] border-t border-slate-800/80 px-4 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Paste any code in any language • Enforces learned conventions
            </span>
            <button
              onClick={handleReview}
              disabled={isReviewing || !code.trim()}
              className="btn btn-sm bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 border-none text-white font-semibold shadow-md shadow-violet-600/30 rounded-lg ml-auto flex items-center gap-2 text-xs"
            >
              {isReviewing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Reviewing with Memory...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Review Code</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right Half: AI Review Console Stretched Edge-to-Edge */}
        <section className="w-full lg:w-1/2 h-full flex flex-col bg-[#0b0f1a] overflow-hidden">
          {/* Review Header Toolbar */}
          <div className="h-11 min-h-[44px] bg-[#0c101d] border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-200">
              <Layers size={15} className="text-emerald-400" />
              <span>REVIEW FINDINGS</span>
            </div>
            {reviewResult && (
              <span className="badge badge-sm bg-[#121829] border border-slate-700 text-xs text-slate-300 font-semibold px-2 py-0.5">
                {reviewResult.findings.length} issue{reviewResult.findings.length === 1 ? '' : 's'} identified
              </span>
            )}
          </div>

          {/* Review Scrollable Findings View */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {/* Empty Awaiting Submission State */}
            {!reviewResult && !isReviewing && (
              <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <div className="w-14 h-14 rounded-2xl bg-[#121829] border border-slate-700/60 flex items-center justify-center mb-3 text-slate-400 shadow-md">
                  <Code2 size={26} />
                </div>
                <h3 className="text-slate-200 font-bold text-sm mb-1">Awaiting Code Submission</h3>
                <p className="text-xs max-w-sm text-slate-400 leading-relaxed">
                  Paste code in any programming language into the editor on the left and click <strong>Review Code</strong>.
                </p>
              </div>
            )}

            {/* Reviewing In-Progress State */}
            {isReviewing && (
              <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-violet-600/15 border border-violet-500/40 flex items-center justify-center text-violet-400 animate-pulse shadow-lg shadow-violet-500/10">
                  <Brain size={30} />
                </div>
                <h3 className="text-slate-200 font-bold text-sm">Consulting Team Memory...</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Recalling relevant engineering standards, architectural decisions, and accepted review patterns from Hindsight.
                </p>
              </div>
            )}

            {/* Review Results Output */}
            {reviewResult && !isReviewing && (
              <>
                {/* Mode Alert Header Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 shadow-md ${
                    reviewResult.review_mode === 'memory_informed'
                      ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#121829] border-slate-700/60 text-slate-300'
                  }`}
                >
                  <Brain
                    size={20}
                    className={reviewResult.review_mode === 'memory_informed' ? 'text-emerald-400 shrink-0 mt-0.5' : 'text-slate-400 shrink-0 mt-0.5'}
                  />
                  <div className="text-xs flex-1">
                    <div className="font-bold flex items-center justify-between">
                      <span className="text-sm">
                        {reviewResult.review_mode === 'memory_informed'
                          ? 'Informed by Team Memory'
                          : 'Baseline Review (Standard Rules)'}
                      </span>
                      {reviewResult.detected_language && (
                        <span className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-mono text-slate-300 uppercase font-semibold">
                          {reviewResult.detected_language}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 mt-1.5 leading-relaxed text-xs">
                      {reviewResult.summary}
                    </p>
                    {reviewResult.memories_retrieved && reviewResult.memories_retrieved.length > 0 && (
                      <p className="text-emerald-400 text-[11.5px] mt-2 font-semibold">
                        ✓ Retrieved {reviewResult.memories_retrieved.length} relevant convention(s) from persistent memory
                      </p>
                    )}
                  </div>
                </div>

                {/* Finding Cards */}
                {reviewResult.findings.map((f) => {
                  const isAccepted = acceptedFindings.has(f.id);
                  const isRejected = rejectedFindings.has(f.id);

                  return (
                    <div
                      key={f.id}
                      className={`p-4 rounded-xl border transition-all shadow-md ${
                        f.memory_used
                          ? 'bg-[#111728] border-emerald-500/50 shadow-emerald-500/5'
                          : 'bg-[#101524] border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`badge badge-xs font-bold uppercase tracking-wider py-2 px-2.5 ${
                              f.severity === 'high'
                                ? 'badge-error text-white'
                                : f.severity === 'medium'
                                ? 'badge-warning text-black font-extrabold'
                                : 'badge-info text-white'
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="badge badge-xs bg-[#19223a] border border-slate-700 text-slate-300 py-2 px-2">
                            {f.category}
                          </span>
                          {f.memory_used && (
                            <span className="badge badge-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/40 py-2 px-2 font-bold">
                              🧠 Learned Rule
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-slate-100 mb-1.5">
                        {f.title}
                      </h4>

                      {/* Memory Citation Highlight Box */}
                      {f.memory_used && f.memory_citation && (
                        <div className="mb-2.5 p-3 rounded-lg bg-emerald-950/40 border-l-2 border-emerald-400 text-xs text-emerald-300 flex items-start gap-2.5">
                          <Brain size={15} className="shrink-0 mt-0.5 text-emerald-400" />
                          <div>
                            <span className="font-bold text-emerald-200">Established Team Convention: </span>
                            "{f.memory_citation}"
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        {f.description}
                      </p>

                      {f.suggestion && (
                        <div className="p-3 rounded-lg bg-[#080b12] border border-slate-800 text-xs text-emerald-300 font-mono overflow-x-auto mb-3">
                          <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block mb-1">
                            Actionable Suggestion:
                          </span>
                          {f.suggestion}
                        </div>
                      )}

                      {/* Interactive Learning Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-800/80">
                        {isAccepted ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 size={15} />
                            <span>Saved as Team Convention!</span>
                          </div>
                        ) : isRejected ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                            <XCircle size={15} />
                            <span>Marked as Team Exception</span>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDecision(f, 'reject')}
                              className="btn btn-xs bg-[#19223a] hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border-slate-700 font-medium rounded-lg"
                              title="Reject: Allow this pattern in this context"
                            >
                              <XCircle size={12} />
                              <span>Reject Exception</span>
                            </button>
                            <button
                              onClick={() => handleDecision(f, 'accept')}
                              className="btn btn-xs bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border-emerald-500/40 font-semibold rounded-lg"
                              title="Accept: Persist this convention into Hindsight memory"
                            >
                              <CheckCircle2 size={12} />
                              <span>Accept as Convention</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Hidden Slide-Over Drawer for Stored Team Memories */}
      {isMemoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-[#0c101d] border-l border-slate-800 h-full flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Team Memory Bank</h3>
                <span className="badge badge-sm badge-success text-[10px] font-bold">
                  {memories.length} stored
                </span>
              </div>
              <button
                onClick={() => setIsMemoryDrawerOpen(false)}
                className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search filter */}
            <div className="py-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter team conventions..."
                  value={memorySearch}
                  onChange={(e) => setMemorySearch(e.target.value)}
                  className="input input-sm w-full pl-9 bg-[#121829] border-slate-700 text-xs rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Memory List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredMemories.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 text-xs p-4">
                  <BookOpen size={28} className="mb-2 text-slate-600" />
                  <p>No team memories found matching filter.</p>
                </div>
              ) : (
                filteredMemories.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-3 rounded-lg bg-[#121829] border border-slate-800 text-xs text-slate-300 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="badge badge-xs bg-violet-950/60 border border-violet-500/40 text-violet-300 uppercase font-mono">
                        {m.fact_type || "convention"}
                      </span>
                      <span>
                        {m.created_at ? new Date(m.created_at).toLocaleDateString() : "Saved"}
                      </span>
                    </div>
                    <p className="text-slate-200 leading-snug">
                      {m.text}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer: Refresh & Reset */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={fetchMemories}
                disabled={isMemoriesLoading}
                className="btn btn-xs btn-ghost text-slate-400 hover:text-slate-200 gap-1"
              >
                <RefreshCw size={12} className={isMemoriesLoading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleResetBank}
                disabled={isResetting}
                className="btn btn-xs btn-outline btn-error text-xs gap-1"
                title="Clear all stored memories for a clean demo"
              >
                <RotateCcw size={12} />
                <span>Reset Bank</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
