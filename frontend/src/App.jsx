import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import confetti from 'canvas-confetti';
import DiffViewer from './components/DiffViewer';
import AgentTimeline from './components/AgentTimeline';
import {
  Brain,
  Code2,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Search,
  X,
  Trash2,
  BookOpen,
  ChevronDown,
  GitPullRequest,
  Activity,
  Layers,
  ShieldCheck,
  Globe,
  GitBranch,
  FolderGit2,
  FileText,
  ExternalLink,
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
  const [activeFileName, setActiveFileName] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [reviewLatency, setReviewLatency] = useState(null);

  const [memories, setMemories] = useState([]);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
  const [isMemoryDrawerOpen, setIsMemoryDrawerOpen] = useState(false);
  const [memorySearch, setMemorySearch] = useState("");
  
  const [acceptedFindings, setAcceptedFindings] = useState(new Set());
  const [dismissedFindings, setDismissedFindings] = useState(new Set());
  const [isResetting, setIsResetting] = useState(false);
  
  // Repository Review Mode State
  const [reviewMode, setReviewMode] = useState("code"); // "code" | "repository"
  const [repoUrl, setRepoUrl] = useState("");
  const [repoBranch, setRepoBranch] = useState("main");
  const [repoReviewResult, setRepoReviewResult] = useState(null);
  const [isRepoReviewing, setIsRepoReviewing] = useState(false);
  const [selectedRepoFixIndex, setSelectedRepoFixIndex] = useState(0);

  // UI Panels & Filters
  const [activeRightTab, setActiveRightTab] = useState("findings"); // "findings" | "diff" | "pipeline"
  const [severityFilter, setSeverityFilter] = useState("all");
  const [showMemoryContext, setShowMemoryContext] = useState(false);
  const [showWhyMatters, setShowWhyMatters] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState(new Set());

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

  const handleClear = () => {
    setCode("");
    setActiveFileName("");
    setReviewResult(null);
    setDetectedLanguage("");
    setReviewLatency(null);
    setActiveRightTab("findings");
  };

  const handleReview = async () => {
    if (!code.trim()) {
      alert("Please paste or write some code to review.");
      return;
    }

    setIsReviewing(true);
    setReviewResult(null);
    const startTime = performance.now();

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          file_name: activeFileName,
          language: selectedLanguage,
          bypass_memory: !memoryEnabled
        })
      });

      const endTime = performance.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(1);
      setReviewLatency(elapsedSeconds);

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

  const handleRepoReview = async (overrideUrl) => {
    const targetUrl = overrideUrl || repoUrl;
    if (!targetUrl || !targetUrl.trim()) {
      alert("Please enter a public GitHub repository URL (e.g. https://github.com/pallets/flask)");
      return;
    }

    setIsRepoReviewing(true);
    setRepoReviewResult(null);
    setSelectedRepoFixIndex(0);
    const startTime = performance.now();

    try {
      const res = await fetch('/api/repository-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: targetUrl.trim(),
          branch: repoBranch.trim() || "main",
          bypass_memory: !memoryEnabled
        })
      });

      const endTime = performance.now();
      const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(1);
      setReviewLatency(elapsedSeconds);

      if (res.ok) {
        const data = await res.json();
        setRepoReviewResult(data);
      } else {
        const err = await res.json();
        alert(`Repository review failed: ${err.detail || "Server error"}`);
      }
    } catch (err) {
      alert(`Network error connecting to review service: ${err.message}`);
    } finally {
      setIsRepoReviewing(false);
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
            particleCount: 75,
            spread: 50,
            origin: { y: 0.6 }
          });
        }
        setTimeout(fetchMemories, 600);
      }
    } catch (err) {
      alert(`Failed to save decision: ${err.message}`);
    }
  };

  const handleDismiss = (findingId) => {
    setDismissedFindings((prev) => new Set(prev).add(findingId));
  };

  const toggleDetails = (findingId) => {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(findingId)) next.delete(findingId);
      else next.add(findingId);
      return next;
    });
  };

  const handleResetBank = async () => {
    if (!window.confirm("Are you sure you want to clear all team memories for a fresh start?")) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/memory/reset', { method: 'POST' });
      if (res.ok) {
        setMemories([]);
        setAcceptedFindings(new Set());
        setDismissedFindings(new Set());
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

  // Active result and state based on reviewMode
  const activeResult = reviewMode === "repository" ? repoReviewResult : reviewResult;
  const isCurrentlyReviewing = reviewMode === "repository" ? isRepoReviewing : isReviewing;
  const currentProposedFixes = reviewMode === "repository"
    ? (repoReviewResult?.proposed_fixes || [])
    : (reviewResult?.proposed_fix ? [reviewResult.proposed_fix] : []);

  // Severity Counts
  const findingsList = activeResult?.findings || [];
  const highCount = findingsList.filter(f => f.severity === 'high').length;
  const medCount = findingsList.filter(f => f.severity === 'medium').length;
  const lowCount = findingsList.filter(f => f.severity === 'low' || f.severity === 'info').length;

  const displayedFindings = findingsList.filter(f => {
    if (dismissedFindings.has(f.id)) return false;
    if (severityFilter === "high") return f.severity === 'high';
    if (severityFilter === "medium") return f.severity === 'medium';
    if (severityFilter === "low") return f.severity === 'low' || f.severity === 'info';
    return true;
  });

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#07090e] text-slate-100 font-sans select-none">
      {/* 1. Top Application Header: Professional Product Branding & Navigation */}
      <header className="h-[54px] min-h-[54px] w-full bg-[#0a0d14] border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between z-30 shrink-0">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-500 to-teal-400 p-[1px] shadow-md shadow-violet-500/10 shrink-0">
            <div className="w-full h-full bg-[#090c14] rounded-[7px] flex items-center justify-center text-white">
              <Brain size={16} className="text-teal-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold tracking-tight text-white leading-none">
                Engram
              </h1>
              <span className="badge badge-xs bg-violet-950/60 text-violet-300 border border-violet-500/30 text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5">
                HINDSIGHT AI
              </span>
            </div>
            <span className="text-[11px] text-slate-400 leading-tight mt-1 hidden sm:inline">
              Self-improving code review agent with persistent team memory
            </span>
          </div>
        </div>

        {/* Center: Mode Switcher (Code Snippet Review vs GitHub Repository Review) */}
        <div className="flex items-center bg-[#101422] border border-white/[0.08] rounded-lg p-0.5 text-xs shadow-inner">
          <button
            onClick={() => setReviewMode("code")}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              reviewMode === "code"
                ? "bg-violet-950/80 text-violet-200 border border-violet-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code2 size={13} />
            <span>Code Review</span>
          </button>
          <button
            onClick={() => setReviewMode("repository")}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              reviewMode === "repository"
                ? "bg-gradient-to-r from-teal-900/60 to-violet-900/60 text-teal-200 border border-teal-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe size={13} />
            <span>GitHub Repository</span>
            <span className="badge badge-xs bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[9px] font-bold">
              MVP
            </span>
          </button>
        </div>

        {/* Right: Refined Team Memory Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMemoryDrawerOpen(true)}
            className="group flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#0e1320] hover:bg-[#141a2c] border border-white/[0.08] hover:border-teal-500/40 shadow-sm transition-all text-left"
            title="Inspect stored team conventions"
          >
            <Brain size={16} className="text-teal-400 shrink-0 group-hover:scale-105 transition-transform" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white leading-tight">
                Team Memory
              </span>
              <span className="text-[10px] font-medium text-slate-400 group-hover:text-teal-300/90 leading-tight font-mono">
                {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* Main Framed Split View (Left: Editor | Right: Review) */}
      <main className="flex-1 min-h-0 w-full p-2 sm:p-3 gap-2 sm:gap-3 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Switchable between Monaco Code Editor and GitHub Repository Review */}
        {reviewMode === "code" ? (
          <section className="w-full lg:w-1/2 h-full flex flex-col bg-[#0a0d14] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl shadow-black/80">
            {/* Editor Sub-Header Toolbar */}
            <div className="h-10 min-h-[40px] bg-[#0c101a] border-b border-white/[0.06] px-3 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Code2 size={15} className="text-violet-400 shrink-0" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="select select-bordered select-xs bg-[#101422] text-slate-200 border-white/[0.08] text-xs rounded-md focus:outline-none focus:border-violet-500 font-medium"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.label}
                    </option>
                  ))}
                </select>

                {activeFileName && (
                  <span className="text-[11px] font-mono text-slate-400 border-l border-white/[0.08] pl-2 hidden sm:inline">
                    {activeFileName}
                  </span>
                )}

                {detectedLanguage && selectedLanguage === "auto" && (
                  <span className="badge badge-xs bg-violet-950/60 border border-violet-500/40 text-violet-300 text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 uppercase">
                    Detected: {detectedLanguage}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {code && (
                  <button
                    onClick={handleClear}
                    className="btn btn-ghost btn-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px] font-medium"
                    title="Clear editor code"
                  >
                    <Trash2 size={12} />
                    <span>Clear</span>
                  </button>
                )}

                {/* Primary Review Code Action */}
                <button
                  onClick={handleReview}
                  disabled={isReviewing || !code.trim()}
                  className="btn btn-sm h-7 min-h-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:opacity-90 border-none text-white font-semibold shadow-sm rounded-md flex items-center gap-1.5 text-xs transition-all px-3"
                >
                  {isReviewing ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      <span>Review Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Monaco Editor Canvas */}
            <div className="flex-1 w-full h-full relative overflow-hidden bg-[#07090f]">
              {(!code || code.trim() === "") && (
                <div className="absolute top-4 left-14 pointer-events-none z-10 flex flex-col font-mono text-[12.5px] text-slate-500/80 select-none">
                  <p># Paste code here to review</p>
                </div>
              )}
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
                  padding: { top: 10, bottom: 10 },
                  backgroundColor: "#07090f"
                }}
              />
            </div>

            {/* Editor Footer Hint */}
            <div className="h-7 min-h-[28px] bg-[#0c101a] border-t border-white/[0.06] px-3 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span>
                {memoryEnabled
                  ? "🧠 Memory Active: Review will apply learned team conventions"
                  : "○ Baseline Mode: Generic isolated review without team memory"}
              </span>
              <span className="font-mono text-[10px]">
                {code ? `${code.split('\n').length} lines` : "Empty workspace"}
              </span>
            </div>
          </section>
        ) : (
          /* Left Column: GitHub Repository Review Panel */
          <section className="w-full lg:w-1/2 h-full flex flex-col bg-[#0a0d14] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl shadow-black/80">
            {/* Repo Sub-Header Toolbar */}
            <div className="h-10 min-h-[40px] bg-[#0c101a] border-b border-white/[0.06] px-3.5 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-teal-400 shrink-0" />
                <span className="text-xs font-bold text-slate-200">
                  GitHub Repository Audit
                </span>
                <span className="badge badge-xs bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[9px] font-mono font-medium hidden sm:inline">
                  Streaming Ingestion
                </span>
              </div>

              {repoReviewResult && (
                <button
                  onClick={() => {
                    setRepoReviewResult(null);
                    setRepoUrl("");
                  }}
                  className="btn btn-ghost btn-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[11px] font-medium"
                >
                  <Trash2 size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Repository Input & Quick Selection Strip */}
            <div className="p-3 border-b border-white/[0.06] bg-[#090c14] space-y-2.5 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                    <FolderGit2 size={14} />
                  </div>
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/pallets/flask or pallets/flask"
                    disabled={isRepoReviewing}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRepoReview();
                    }}
                    className="input input-sm w-full pl-8 bg-[#101422] border-white/[0.08] text-xs rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative w-28 sm:w-28">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-500">
                      <GitBranch size={12} />
                    </div>
                    <input
                      type="text"
                      value={repoBranch}
                      onChange={(e) => setRepoBranch(e.target.value)}
                      placeholder="main"
                      disabled={isRepoReviewing}
                      className="input input-sm w-full pl-6 bg-[#101422] border-white/[0.08] text-xs rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                    />
                  </div>

                  <button
                    onClick={() => handleRepoReview()}
                    disabled={isRepoReviewing || !repoUrl.trim()}
                    className="btn btn-sm h-8 min-h-0 bg-gradient-to-r from-teal-600 via-teal-700 to-indigo-700 hover:opacity-90 border-none text-white font-semibold shadow-sm rounded-lg flex items-center gap-1.5 text-xs transition-all px-3.5 shrink-0"
                  >
                    {isRepoReviewing ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Auditing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span>Review Repo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Demo Quick Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-0.5">
                <span className="text-slate-500 font-medium shrink-0">Demo Repos:</span>
                {[
                  { label: "pallets/flask", url: "https://github.com/pallets/flask", branch: "main", tag: "Python" },
                  { label: "tiangolo/fastapi", url: "https://github.com/tiangolo/fastapi", branch: "master", tag: "FastAPI" },
                  { label: "expressjs/express", url: "https://github.com/expressjs/express", branch: "master", tag: "Express" }
                ].map((demo) => (
                  <button
                    key={demo.label}
                    onClick={() => {
                      setRepoUrl(demo.url);
                      setRepoBranch(demo.branch);
                      handleRepoReview(demo.url);
                    }}
                    disabled={isRepoReviewing}
                    className="px-2 py-0.5 rounded-md bg-[#121626] hover:bg-teal-950/50 text-slate-300 hover:text-teal-200 border border-white/[0.06] hover:border-teal-500/30 font-mono text-[10.5px] transition-all flex items-center gap-1 shrink-0"
                  >
                    <span>{demo.label}</span>
                    <span className="text-[9px] text-teal-400/80 font-sans">({demo.tag})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Repository Main Content Canvas */}
            <div className="flex-1 w-full h-full overflow-y-auto p-3.5 bg-[#07090f] space-y-3">
              {/* State 1: Loading Progress */}
              {isRepoReviewing && (
                <div className="h-full flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600/20 to-indigo-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 animate-pulse shadow-lg">
                    <Globe size={28} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-slate-100 font-bold text-sm">Autonomous Repository Ingestion & Review</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Streaming archive, profiling stack, and executing agentic review</p>
                  </div>
                  <div className="w-full max-w-md bg-[#0c101a] border border-white/[0.06] rounded-xl p-3.5 space-y-2 text-[11px] font-mono">
                    <div className="flex items-center gap-2 text-teal-300 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                      <span>1. Streaming tarball in-memory & safe extraction</span>
                    </div>
                    <div className="flex items-center gap-2 text-violet-300 animate-pulse delay-75">
                      <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                      <span>2. Scanning file tree & deterministic stack profiling</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-300 animate-pulse delay-150">
                      <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                      <span>3. Architectural scoring & selecting top 5 core files</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-300 animate-pulse delay-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span>4. Querying Hindsight Cloud for persistent conventions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sky-300 animate-pulse delay-300">
                      <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                      <span>5. Multi-agent review, AST validation, & repo synthesis</span>
                    </div>
                  </div>
                </div>
              )}

              {/* State 2: Welcome / Empty State */}
              {!repoReviewResult && !isRepoReviewing && (
                <div className="h-full flex flex-col justify-center max-w-lg mx-auto py-4 space-y-3">
                  <div className="rounded-xl bg-[#0c101a] border border-white/[0.06] p-4 text-center">
                    <div className="w-11 h-11 rounded-xl bg-teal-950/40 border border-teal-500/30 flex items-center justify-center mx-auto text-teal-400 mb-2.5">
                      <FolderGit2 size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1">
                      Autonomous GitHub Repository Review
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                      Engram autonomously audits public repositories end-to-end: streaming code archives in-memory, profiling dependencies, selecting core architecture files, and enforcing team memory conventions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-lg bg-[#0e1220] border border-white/[0.05] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-teal-300 text-[11.5px]">
                        <Layers size={13} />
                        <span>Deterministic Profiler</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Inspects package manifests (<code className="text-slate-300">pyproject.toml</code>, <code className="text-slate-300">package.json</code>, etc.) to uncover architecture patterns.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0e1220] border border-white/[0.05] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-violet-300 text-[11.5px]">
                        <Brain size={13} />
                        <span>Hindsight Memory</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Recalls persistent conventions and architectural decisions stored in your team's memory bank.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0e1220] border border-white/[0.05] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-300 text-[11.5px]">
                        <ShieldCheck size={13} />
                        <span>Zero Execution Risk</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Safe in-memory archive extraction protects against Zip Slip, with automated secret redaction.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0e1220] border border-white/[0.05] space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-300 text-[11.5px]">
                        <GitPullRequest size={13} />
                        <span>AST-Validated Diffs</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Self-healing retry loops verify proposed code modifications using language AST parsers.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* State 3: Repository Review Completed */}
              {repoReviewResult && !isRepoReviewing && (
                <div className="space-y-3">
                  {/* Repo Summary Header Card */}
                  <div className="p-3.5 rounded-xl bg-[#0c101a] border border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FolderGit2 size={16} className="text-teal-400 shrink-0" />
                        <a
                          href={repoReviewResult.repository.startsWith('http') ? repoReviewResult.repository : `https://github.com/${repoReviewResult.repository}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-slate-100 hover:text-teal-300 flex items-center gap-1 text-sm font-mono transition-colors"
                        >
                          <span>{repoReviewResult.owner}/{repoReviewResult.repo_name}</span>
                          <ExternalLink size={12} className="text-slate-500" />
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="badge badge-sm bg-[#121626] border-white/[0.08] text-slate-300 text-[10px] font-mono flex items-center gap-1">
                          <GitBranch size={10} className="text-slate-400" />
                          <span>{repoReviewResult.branch}</span>
                        </span>
                        <span className="badge badge-sm bg-teal-950/60 border-teal-500/30 text-teal-300 text-[10px] font-mono">
                          {repoReviewResult.total_files_discovered} files scanned
                        </span>
                      </div>
                    </div>

                    {/* Detected Stack & Language Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                        Stack:
                      </span>
                      <span className="badge badge-xs bg-violet-950/70 border-violet-500/40 text-violet-300 text-[10px] font-mono font-bold">
                        {repoReviewResult.project_profile.primary_language}
                      </span>
                      {repoReviewResult.project_profile.detected_stack.map((item, idx) => (
                        <span
                          key={idx}
                          className="badge badge-xs bg-[#141a2c] border-white/[0.08] text-slate-300 text-[10px] font-medium"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    {/* Architectural Summary */}
                    <div className="p-2.5 rounded-lg bg-[#080b12] border border-white/[0.05] text-xs text-slate-300 leading-relaxed">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-teal-400 mb-0.5">
                        Architectural Blueprint
                      </div>
                      <p className="text-[11.5px] text-slate-300">
                        {repoReviewResult.project_profile.architecture_summary}
                      </p>
                      {repoReviewResult.project_profile.key_directories?.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-mono">
                          <span className="text-slate-500">Key modules:</span>
                          {repoReviewResult.project_profile.key_directories.map((dir, i) => (
                            <span key={i} className="px-1.5 py-0.2 rounded bg-slate-900 border border-white/[0.06] text-slate-300">
                              {dir}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prioritized Architectural Files Table */}
                  <div className="rounded-xl bg-[#0c101a] border border-white/[0.08] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-violet-400" />
                        <h4 className="text-xs font-bold text-slate-200">
                          Prioritized Core Files ({repoReviewResult.files_reviewed.length})
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Layer-diverse architectural sample
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {repoReviewResult.files_reviewed.map((file, idx) => {
                        const hasFix = repoReviewResult.proposed_fixes?.some(
                          (fix) => fix.file_name === file.file_path || (fix.unified_diff && fix.unified_diff.length > 0)
                        );

                        return (
                          <div
                            key={idx}
                            className="p-2 rounded-lg bg-[#080b12] hover:bg-[#0f1422] border border-white/[0.05] transition-all flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText size={13} className="text-teal-400 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-mono font-semibold text-slate-200 truncate">
                                  {file.file_path}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                  <span className="text-teal-300/90 font-medium">{file.role}</span>
                                  <span>•</span>
                                  <span className="font-mono">{file.line_count} lines</span>
                                  <span>•</span>
                                  <span className="font-mono">{(file.size_bytes / 1024).toFixed(1)} KB</span>
                                </div>
                              </div>
                            </div>

                            {hasFix && (
                              <button
                                onClick={() => {
                                  const fixIdx = repoReviewResult.proposed_fixes.findIndex(
                                    (fix) => fix.file_name === file.file_path
                                  );
                                  if (fixIdx >= 0) setSelectedRepoFixIndex(fixIdx);
                                  setActiveRightTab("diff");
                                }}
                                className="btn btn-xs h-6 min-h-0 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold rounded shrink-0 flex items-center gap-1"
                              >
                                <GitPullRequest size={10} />
                                <span>Inspect Diff</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Repository Footer Hint */}
            <div className="h-7 min-h-[28px] bg-[#0c101a] border-t border-white/[0.06] px-3 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span>
                {memoryEnabled
                  ? "🧠 Hindsight Active: Analyzing repo against team conventions"
                  : "○ Baseline Mode: Isolated repository review without team memory"}
              </span>
              <span className="font-mono text-[10px]">
                {repoReviewResult ? `${repoReviewResult.files_reviewed.length} files analyzed` : "Public repositories only"}
              </span>
            </div>
          </section>
        )}

        {/* Right Column: Redesigned Review Findings Panel */}
        <section className="w-full lg:w-1/2 h-full flex flex-col bg-[#0a0d14] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl shadow-black/80">
          {/* 1. Review Summary Header with Embedded Review Mode Selector */}
          <div className="h-10 min-h-[40px] bg-[#0c101a] border-b border-white/[0.06] px-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Review Findings
              </span>
              {reviewLatency && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-white/[0.06] px-1.5 py-0.5 rounded">
                  ⚡ {reviewLatency}s
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Review Mode Selector (Hindsight vs Baseline) */}
              <div className="flex items-center gap-1.5">
                <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Review Mode:
                </span>
                <div className="flex items-center bg-[#101422] border border-white/[0.08] rounded-md p-0.5 text-xs">
                  <button
                    onClick={() => setMemoryEnabled(true)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
                      memoryEnabled
                        ? 'bg-teal-950/70 text-teal-300 border border-teal-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Hindsight Memory ON: Applies persistent team conventions"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${memoryEnabled ? 'bg-teal-400 shadow-[0_0_6px_#2dd4bf]' : 'bg-slate-600'}`} />
                    <span>🧠 Hindsight ON</span>
                  </button>
                  <button
                    onClick={() => setMemoryEnabled(false)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                      !memoryEnabled
                        ? 'bg-slate-800 text-slate-200 border border-white/[0.1] shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Baseline Mode: Standard review without team memory"
                  >
                    <span>○ Baseline</span>
                  </button>
                </div>
              </div>

              {/* Finding Counters if review completed */}
              {activeResult && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs border-l border-white/[0.08] pl-2">
                  <span className="font-bold text-slate-300">
                    {findingsList.length} Issue{findingsList.length === 1 ? '' : 's'}
                  </span>
                  {highCount > 0 && (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded">
                      {highCount} High
                    </span>
                  )}
                  {medCount > 0 && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded">
                      {medCount} Med
                    </span>
                  )}
                  {lowCount > 0 && (
                    <span className="text-[10px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.2 rounded">
                      {lowCount} Low
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sub-Header Tabs: Findings | Proposed Fix (Diff) | Agent Pipeline */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-[#0c101a] shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveRightTab("findings")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeRightTab === "findings"
                    ? "bg-violet-950/80 text-violet-200 border border-violet-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Code2 size={13} />
                <span>Findings</span>
                {activeResult && (
                  <span className="text-[10px] font-mono px-1 rounded bg-violet-500/20 text-violet-300">
                    {findingsList.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveRightTab("diff")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeRightTab === "diff"
                    ? "bg-emerald-950/80 text-emerald-200 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <GitPullRequest size={13} />
                <span>Proposed Fix & Diff</span>
                {currentProposedFixes.length > 0 && (
                  <span className="badge badge-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">
                    {currentProposedFixes.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveRightTab("pipeline")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeRightTab === "pipeline"
                    ? "bg-sky-950/80 text-sky-200 border border-sky-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity size={13} />
                <span>Agent Pipeline</span>
                {activeResult?.retry_count > 0 ? (
                  <span className="badge badge-xs bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                    {activeResult.retry_count} retry
                  </span>
                ) : activeResult?.timeline ? (
                  <span className="text-[10px] font-mono px-1 rounded bg-sky-500/20 text-sky-300">
                    {activeResult.timeline.length}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Body Content Area */}
          {/* 1. Loading State */}
          {isCurrentlyReviewing && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-teal-500/20 border border-violet-500/30 flex items-center justify-center text-teal-400 animate-pulse shadow-lg">
                <Brain size={28} />
              </div>
              <div className="text-center">
                <h3 className="text-slate-200 font-bold text-sm">
                  {reviewMode === "repository"
                    ? "Executing Autonomous Repository Audit"
                    : "Executing LangGraph Agentic Pipeline"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {reviewMode === "repository"
                    ? "Multi-file LangGraph pipeline with AST validation & Hindsight recall"
                    : "Multi-agent coordination with AST verification"}
                </p>
              </div>
              <div className="w-full max-w-sm bg-[#0c101a] border border-white/[0.06] rounded-xl p-3.5 space-y-2 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-teal-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                  <span>1. Recall Agent: Consulting Hindsight team memory</span>
                </div>
                <div className="flex items-center gap-2 text-violet-300 animate-pulse delay-75">
                  <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                  <span>2. Analysis Agent: Multi-perspective code audit</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-300 animate-pulse delay-150">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                  <span>3. Fix Agent: Synthesizing replacement code & diff</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-300 animate-pulse delay-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>4. Validation Agent: AST parsing & retry loop check</span>
                </div>
                <div className="flex items-center gap-2 text-rose-300 animate-pulse delay-300">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <span>5. Security Agent: Vulnerability & secret scan</span>
                </div>
                <div className="flex items-center gap-2 text-sky-300 animate-pulse delay-500">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <span>6. Final Review Agent: Assembling verdict & citations</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Empty State */}
          {!activeResult && !isCurrentlyReviewing && (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <div className="w-10 h-10 rounded-xl bg-[#0f1320] border border-white/[0.07] flex items-center justify-center mb-3 text-slate-400 shadow-inner">
                <span className="text-sm text-slate-400 font-mono">◇</span>
              </div>
              <h3 className="text-slate-200 font-bold text-xs uppercase tracking-wider mb-1.5">
                No Review Yet
              </h3>
              <p className="text-[11.5px] max-w-xs text-slate-400 leading-relaxed">
                {reviewMode === "repository"
                  ? "Select or enter a public GitHub repository on the left and click Review Repo."
                  : "Paste code in the editor and click Review Code to run the LangGraph agentic pipeline."}
              </p>
            </div>
          )}

          {/* 3. Review Generated: Tab Panels */}
          {activeResult && !isCurrentlyReviewing && (
            <>
              {/* Tab Panel A: Proposed Fix & Diff */}
              {activeRightTab === "diff" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* File Selector Pills if multiple proposed fixes exist */}
                  {currentProposedFixes.length > 1 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#090c14] border-b border-white/[0.06] overflow-x-auto shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 shrink-0">
                        Files with Fixes:
                      </span>
                      {currentProposedFixes.map((fix, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedRepoFixIndex(idx)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex items-center gap-1 shrink-0 ${
                            selectedRepoFixIndex === idx
                              ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/40 font-bold shadow-sm'
                              : 'bg-[#101422] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
                          }`}
                        >
                          <FileText size={11} className={selectedRepoFixIndex === idx ? 'text-emerald-400' : 'text-slate-500'} />
                          <span>{fix.file_name || `File ${idx + 1}`}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex-1 overflow-hidden">
                    <DiffViewer
                      proposedFix={currentProposedFixes[selectedRepoFixIndex] || currentProposedFixes[0]}
                      onApplyFix={(fixedCode) => {
                        if (reviewMode === "code") {
                          setCode(fixedCode);
                        } else {
                          alert(`Fix for ${currentProposedFixes[selectedRepoFixIndex]?.file_name || "file"} is AST-validated. Ready to apply to your repository branch!`);
                        }
                      }}
                      language={getMonacoLang()}
                    />
                  </div>
                </div>
              )}

              {/* Tab Panel B: Agent Pipeline Timeline */}
              {activeRightTab === "pipeline" && (
                <div className="flex-1 overflow-hidden">
                  <AgentTimeline
                    timeline={activeResult.timeline || []}
                    isReviewing={isCurrentlyReviewing}
                  />
                </div>
              )}

              {/* Tab Panel C: Findings Cards */}
              {activeRightTab === "findings" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Compact Hindsight Memory Context Strip */}
                  <div className={`mx-3 mt-2.5 p-2.5 rounded-lg border text-xs shrink-0 transition-all ${
                    activeResult.review_mode === 'memory_informed'
                      ? 'bg-teal-950/20 border-teal-500/30 text-teal-200'
                      : 'bg-slate-900/60 border-white/[0.06] text-slate-400'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Brain
                          size={14}
                          className={activeResult.review_mode === 'memory_informed' ? 'text-teal-400' : 'text-slate-500'}
                        />
                        <span className="font-semibold text-slate-200">
                          {activeResult.review_mode === 'memory_informed'
                            ? `Hindsight: ${activeResult.memories_retrieved?.length || 0} relevant team convention(s) applied`
                            : 'Baseline Mode: Generic review — no team memory supplied'}
                        </span>
                      </div>
                      {activeResult.memories_retrieved?.length > 0 && (
                        <button
                          onClick={() => setShowMemoryContext(!showMemoryContext)}
                          className="text-[11px] text-teal-400 hover:underline flex items-center gap-0.5 font-medium"
                        >
                          <span>{showMemoryContext ? 'Hide' : 'View context'}</span>
                          <ChevronDown size={11} className={`transition-transform ${showMemoryContext ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {showMemoryContext && activeResult.memories_retrieved?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-teal-500/20 space-y-1">
                        {activeResult.memories_retrieved.map((m, idx) => (
                          <div key={idx} className="text-[11px] text-teal-300/90 font-mono bg-teal-950/40 p-1.5 rounded border border-teal-500/20">
                            • {m}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interactive Filter Tabs */}
                  <div className="flex items-center gap-1 px-3 pt-2.5 pb-1 border-b border-white/[0.04] shrink-0 text-xs">
                    <button
                      onClick={() => setSeverityFilter("all")}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                        severityFilter === 'all'
                          ? 'bg-slate-800 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({findingsList.length})
                    </button>
                    <button
                      onClick={() => setSeverityFilter("high")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                        severityFilter === 'high'
                          ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                          : 'text-slate-400 hover:text-rose-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> High ({highCount})
                    </button>
                    <button
                      onClick={() => setSeverityFilter("medium")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                        severityFilter === 'medium'
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                          : 'text-slate-400 hover:text-amber-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Medium ({medCount})
                    </button>
                    <button
                      onClick={() => setSeverityFilter("low")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                        severityFilter === 'low'
                          ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30'
                          : 'text-slate-400 hover:text-sky-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Low ({lowCount})
                    </button>
                  </div>

                  {/* Scrollable Compact Finding Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                    {displayedFindings.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No findings matching this filter.
                      </div>
                    ) : (
                      displayedFindings.map((f) => {
                        const isAccepted = acceptedFindings.has(f.id);
                        const isHigh = f.severity === 'high';
                        const isMed = f.severity === 'medium';

                        return (
                          <div
                            key={f.id}
                            className={`rounded-lg p-3 transition-all border ${
                              isHigh
                                ? 'bg-[#100e14] border-l-4 border-l-rose-500 border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06]'
                                : isMed
                                ? 'bg-[#121014] border-l-4 border-l-amber-500 border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06]'
                                : 'bg-[#0c101a] border-l-4 border-l-sky-500 border-t-white/[0.06] border-r-white/[0.06] border-b-white/[0.06]'
                            }`}
                          >
                            {/* Card Header Row */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                                    isHigh
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      : isMed
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                  }`}
                                >
                                  {isHigh ? '🔴 HIGH' : isMed ? '🟡 MEDIUM' : '🔵 LOW'}
                                </span>

                                <span className="text-[10px] font-semibold uppercase text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-white/[0.06]">
                                  {f.category}
                                </span>

                                {f.file_path && (
                                  <span className="text-[10px] font-mono text-teal-300 bg-teal-950/60 border border-teal-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <FileText size={10} className="text-teal-400" />
                                    <span>{f.file_path}</span>
                                  </span>
                                )}

                                {f.memory_used && (
                                  <span className="text-[10px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    🧠 Learned Convention
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Title */}
                            <h4 className="text-[13px] font-bold text-slate-100 mb-1">
                              {f.title}
                            </h4>

                            {/* Concise Explanation */}
                            <p className="text-xs text-slate-300 leading-relaxed mb-2">
                              {f.description}
                            </p>

                            {/* Distinct Hindsight Citation Box */}
                            {f.memory_used && f.memory_citation && (
                              <div className="mb-2 p-2 rounded bg-teal-950/30 border border-teal-500/30 text-xs text-teal-300 flex items-start gap-2">
                                <Brain size={13} className="text-teal-400 shrink-0 mt-0.5" />
                                <div className="leading-snug">
                                  <span className="font-bold text-teal-200">Team Convention Applied: </span>
                                  "{f.memory_citation}"
                                  <span className="block text-[10px] text-teal-400/70 mt-0.5">
                                    Source: Previous team decision stored in Hindsight
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Concise Fix Block */}
                            {f.suggestion && (
                              <div className="mb-2 p-2 rounded bg-[#070910] border border-white/[0.05] text-[11.5px] font-mono text-emerald-300 overflow-x-auto">
                                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase block mb-0.5">
                                  Fix →
                                </span>
                                {f.suggestion}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-white/[0.05]">
                              {isAccepted ? (
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-teal-400">
                                  <CheckCircle2 size={13} />
                                  <span>Saved to Hindsight Team Memory</span>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleDismiss(f.id)}
                                    className="btn btn-xs h-6 min-h-0 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/[0.06] text-[11px] font-medium rounded"
                                    title="Dismiss this finding for this review"
                                  >
                                    Dismiss
                                  </button>
                                  <button
                                    onClick={() => handleDecision(f, 'accept')}
                                    className="btn btn-xs h-6 min-h-0 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 text-[11px] font-semibold rounded flex items-center gap-1"
                                    title="Accept: Persist this convention into Hindsight long-term team memory"
                                  >
                                    <Brain size={11} className="text-teal-400" />
                                    <span>Accept as Convention</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* "Why Hindsight Matters" Collapsible Box */}
                    <div className="rounded-lg bg-[#0c101a] border border-white/[0.06] p-2.5 text-xs">
                      <div
                        onClick={() => setShowWhyMatters(!showWhyMatters)}
                        className="flex items-center justify-between cursor-pointer text-slate-300 hover:text-white font-semibold select-none"
                      >
                        <span className="flex items-center gap-1.5 text-violet-400 text-[11.5px]">
                          <Sparkles size={12} /> Why Hindsight Matters (Judge Summary)
                        </span>
                        <ChevronDown size={13} className={`transition-transform text-slate-400 ${showWhyMatters ? 'rotate-180' : ''}`} />
                      </div>

                      {showWhyMatters && (
                        <div className="mt-2 pt-2 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 rounded bg-slate-900 border border-white/[0.05]">
                            <span className="text-slate-400 font-bold block mb-0.5">Without Memory (Generic AI):</span>
                            <p className="text-slate-400 leading-snug">"Consider using a repository pattern." (Isolated textbook feedback, repeats every review).</p>
                          </div>
                          <div className="p-2 rounded bg-teal-950/30 border border-teal-500/30">
                            <span className="text-teal-400 font-bold block mb-0.5">With Hindsight:</span>
                            <p className="text-teal-200 leading-snug">"Conflicts with established team convention. Your team previously decided all DB access must use Repository classes."</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Slide-Over Drawer for Team Memory Bank */}
      {isMemoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-[#0a0d14] border-l border-white/[0.08] h-full flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Brain size={17} className="text-teal-400" />
                <h3 className="font-bold text-sm text-slate-100">Team Memory Bank</h3>
                <span className="badge badge-sm bg-teal-500/20 text-teal-300 border-teal-500/40 text-[10px] font-bold">
                  {memories.length} stored
                </span>
              </div>
              <button
                onClick={() => setIsMemoryDrawerOpen(false)}
                className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-200"
              >
                <X size={15} />
              </button>
            </div>

            {/* Search filter */}
            <div className="py-2.5">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter team conventions..."
                  value={memorySearch}
                  onChange={(e) => setMemorySearch(e.target.value)}
                  className="input input-sm w-full pl-8 bg-[#101422] border-white/[0.08] text-xs rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Memory List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredMemories.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center text-slate-500 text-xs p-4">
                  <BookOpen size={26} className="mb-2 text-slate-600" />
                  <p>No team memories found matching filter.</p>
                </div>
              ) : (
                filteredMemories.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-2.5 rounded-lg bg-[#0e121e] border border-white/[0.06] text-xs text-slate-300 space-y-1"
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
                className="btn btn-xs btn-ghost text-slate-400 hover:text-slate-200 gap-1 text-[11px]"
              >
                <RefreshCw size={11} className={isMemoriesLoading ? "animate-spin" : ""} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleResetBank}
                disabled={isResetting}
                className="btn btn-xs btn-outline btn-error text-[11px] gap-1"
                title="Clear all stored team memories"
              >
                <RotateCcw size={11} />
                <span>Reset Bank</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
