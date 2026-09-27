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
  ArrowRight,
  ShieldCheck,
  Cpu,
  SlidersHorizontal
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
            particleCount: 80,
            spread: 55,
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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#07090e] text-slate-100 font-sans relative selection:bg-violet-500/30 selection:text-white">
      {/* Ambient Glow Accents (Cursor & Linear inspired) */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-violet-600/[0.07] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-0 right-1/4 w-96 h-96 bg-emerald-500/[0.06] rounded-full blur-3xl pointer-events-none" />

      {/* Sleek, Luxury Dark Navbar */}
      <header className="h-14 min-h-[56px] w-full bg-[#0a0d16]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 md:px-6 flex items-center justify-between z-30 shrink-0">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-500 to-emerald-400 p-[1px] shadow-lg shadow-violet-500/20">
            <div className="w-full h-full bg-[#090c15] rounded-[7px] flex items-center justify-center text-white">
              <Brain size={17} className="text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[15px] font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent leading-none">
              Codebase Memory
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400 border-l border-white/[0.1] pl-2.5 leading-none">
              AI Code Review • Persistent Team Knowledge
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Memory Layer Toggle Pill */}
          <div
            onClick={() => setMemoryEnabled(!memoryEnabled)}
            className={`flex items-center gap-2 border rounded-full px-3 py-1 text-xs cursor-pointer transition-all duration-200 select-none ${
              memoryEnabled
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-900 border-white/[0.08] text-slate-400 hover:border-white/[0.15]'
            }`}
            title="Click to toggle Hindsight team memory on or off"
          >
            <div className={`w-2 h-2 rounded-full transition-all ${memoryEnabled ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
            <span className="text-slate-400 hidden sm:inline text-[11px] font-medium">Memory Layer:</span>
            <span className={`text-[11px] font-bold ${memoryEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
              {memoryEnabled ? 'ACTIVE' : 'OFF'}
            </span>
          </div>

          {/* Stored Team Memories Trigger */}
          <button
            onClick={() => setIsMemoryDrawerOpen(true)}
            className="btn btn-sm h-8 min-h-0 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-white/[0.1] hover:border-white/[0.2] rounded-lg flex items-center gap-2 text-xs font-semibold shadow-sm transition-all"
          >
            <BookOpen size={13} className="text-emerald-400" />
            <span className="hidden xs:inline">Team Memories</span>
            <span className="badge badge-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold px-1.5 py-0.5">
              {memories.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Framed Workspace with Subtle Outer Margin (Linear/Cursor feel) */}
      <main className="flex-1 w-full h-[calc(100vh-56px)] p-2.5 sm:p-3.5 md:p-4 gap-3 md:gap-4 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Card: Code Editor */}
        <section className="w-full lg:w-1/2 h-full flex flex-col bg-[#0b0e18] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl shadow-black/80">
          {/* Editor Header Toolbar */}
          <div className="h-10 min-h-[40px] bg-[#0e1220] border-b border-white/[0.06] px-3.5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Code2 size={15} className="text-violet-400 shrink-0" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="select select-bordered select-xs bg-[#121727] text-slate-200 border-white/[0.1] text-xs rounded-md focus:outline-none focus:border-violet-500 font-medium"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>

              {detectedLanguage && selectedLanguage === "auto" && (
                <span className="badge badge-xs bg-violet-950/60 border border-violet-500/40 text-violet-300 text-[10px] font-mono font-bold tracking-wider px-2 py-1 uppercase">
                  Detected: {detectedLanguage}
                </span>
              )}
            </div>

            {code && (
              <button
                onClick={() => { setCode(""); setReviewResult(null); }}
                className="btn btn-ghost btn-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
                title="Clear code"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 w-full h-full relative overflow-hidden bg-[#090c16]">
            <Editor
              height="100%"
              width="100%"
              language={getMonacoLang()}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                backgroundColor: "#090c16"
              }}
            />
          </div>

          {/* Editor Action Bottom Bar */}
          <div className="h-11 min-h-[44px] bg-[#0e1220] border-t border-white/[0.06] px-3.5 flex items-center justify-between shrink-0">
            <span className="text-[11.5px] text-slate-400 font-medium hidden sm:inline">
              Accepts any code • Automatically applies learned standards
            </span>
            <button
              onClick={handleReview}
              disabled={isReviewing || !code.trim()}
              className="btn btn-sm h-8 min-h-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 hover:opacity-90 border-none text-white font-semibold shadow-md shadow-indigo-600/25 rounded-lg ml-auto flex items-center gap-1.5 text-xs transition-all"
            >
              {isReviewing ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Reviewing with Memory...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Review Code</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right Card: AI Review Console */}
        <section className="w-full lg:w-1/2 h-full flex flex-col bg-[#0b0e18] border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl shadow-black/80">
          {/* Review Header Toolbar */}
          <div className="h-10 min-h-[40px] bg-[#0e1220] border-b border-white/[0.06] px-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-200">
              <Layers size={14} className="text-emerald-400" />
              <span>REVIEW FINDINGS</span>
            </div>
            {reviewResult && (
              <span className="badge badge-sm bg-[#121727] border border-white/[0.08] text-xs text-slate-300 font-semibold px-2 py-0.5">
                {reviewResult.findings.length} issue{reviewResult.findings.length === 1 ? '' : 's'} identified
              </span>
            )}
          </div>

          {/* Scrollable Findings */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3.5">
            {/* Empty Awaiting Submission State */}
            {!reviewResult && !isReviewing && (
              <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <div className="w-13 h-13 rounded-2xl bg-[#121727] border border-white/[0.08] flex items-center justify-center mb-3 text-slate-400 shadow-md">
                  <Code2 size={24} />
                </div>
                <h3 className="text-slate-200 font-bold text-sm mb-1">Awaiting Code Submission</h3>
                <p className="text-xs max-w-sm text-slate-400 leading-relaxed">
                  Paste or write code in any language on the left, then click <strong>Review Code</strong> to run review with persistent team memory.
                </p>
              </div>
            )}

            {/* In-Progress State */}
            {isReviewing && (
              <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-13 h-13 rounded-2xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400 animate-pulse shadow-lg shadow-violet-500/10">
                  <Brain size={28} />
                </div>
                <h3 className="text-slate-200 font-bold text-sm">Consulting Team Memory...</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Recalling relevant engineering standards, architectural decisions, and accepted review patterns from Hindsight.
                </p>
              </div>
            )}

            {/* Review Output */}
            {reviewResult && !isReviewing && (
              <>
                {/* Mode Alert Header Banner */}
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 shadow-md ${
                    reviewResult.review_mode === 'memory_informed'
                      ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#121727] border-white/[0.08] text-slate-300'
                  }`}
                >
                  <Brain
                    size={19}
                    className={reviewResult.review_mode === 'memory_informed' ? 'text-emerald-400 shrink-0 mt-0.5' : 'text-slate-400 shrink-0 mt-0.5'}
                  />
                  <div className="text-xs flex-1">
                    <div className="font-bold flex items-center justify-between">
                      <span className="text-[13px]">
                        {reviewResult.review_mode === 'memory_informed'
                          ? 'Informed by Team Memory'
                          : 'Baseline Review (Standard Rules)'}
                      </span>
                      {reviewResult.detected_language && (
                        <span className="text-[10px] bg-slate-900 border border-white/[0.1] px-2 py-0.5 rounded font-mono text-slate-300 uppercase font-semibold">
                          {reviewResult.detected_language}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 mt-1.5 leading-relaxed text-xs">
                      {reviewResult.summary}
                    </p>
                    {reviewResult.memories_retrieved && reviewResult.memories_retrieved.length > 0 && (
                      <p className="text-emerald-400 text-[11px] mt-1.5 font-semibold">
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
                          ? 'bg-[#101526] border-emerald-500/50 shadow-emerald-500/5'
                          : 'bg-[#0f1322] border-white/[0.07] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`badge badge-xs font-bold uppercase tracking-wider py-2 px-2.5 ${
                              f.severity === 'high'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : f.severity === 'medium'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="badge badge-xs bg-[#151b30] border border-white/[0.08] text-slate-300 py-2 px-2 font-medium">
                            {f.category}
                          </span>
                          {f.memory_used && (
                            <span className="badge badge-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/40 py-2 px-2 font-bold">
                              🧠 Learned Rule
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-[13.5px] font-bold text-slate-100 mb-1.5">
                        {f.title}
                      </h4>

                      {/* Memory Citation Highlight Box */}
                      {f.memory_used && f.memory_citation && (
                        <div className="mb-2.5 p-3 rounded-lg bg-emerald-950/40 border-l-2 border-emerald-400 text-xs text-emerald-300 flex items-start gap-2.5">
                          <Brain size={14} className="shrink-0 mt-0.5 text-emerald-400" />
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
                        <div className="p-3 rounded-lg bg-[#070912] border border-white/[0.06] text-xs text-emerald-300 font-mono overflow-x-auto mb-3">
                          <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block mb-1">
                            Actionable Suggestion:
                          </span>
                          {f.suggestion}
                        </div>
                      )}

                      {/* Interactive Learning Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-white/[0.06]">
                        {isAccepted ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 size={14} />
                            <span>Saved as Team Convention!</span>
                          </div>
                        ) : isRejected ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                            <XCircle size={14} />
                            <span>Marked as Team Exception</span>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDecision(f, 'reject')}
                              className="btn btn-xs bg-[#161d30] hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border-white/[0.08] font-medium rounded-lg"
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
          <div className="w-full max-w-md bg-[#0a0d16] border-l border-white/[0.08] h-full flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Team Memory Bank</h3>
                <span className="badge badge-sm bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
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
                  className="input input-sm w-full pl-9 bg-[#121727] border-white/[0.08] text-xs rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
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
                    className="p-3 rounded-lg bg-[#111627] border border-white/[0.06] text-xs text-slate-300 space-y-1.5"
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
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
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
