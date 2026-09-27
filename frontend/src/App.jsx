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
  ChevronDown,
  ShieldAlert,
  AlertTriangle,
  Info,
  Check,
  Eye,
  Sliders
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

const DEMO_STEPS = {
  1: {
    title: "01 Establish Convention",
    fileName: "user_service.py",
    language: "python",
    memoryEnabled: true,
    hint: "Initial PR: Direct database access in route handler. Review and click 'Accept as Convention' to teach Hindsight.",
    code: `from fastapi import APIRouter, HTTPException
import sqlite3

router = APIRouter()

# User Registration Endpoint
@router.post("/users")
def register_user(username: str, email: str):
    # Direct database connection inside route handler
    conn = sqlite3.connect("production.db")
    cursor = conn.cursor()
    
    # Executing raw SQL directly in service logic
    cursor.execute(
        "INSERT INTO users (username, email) VALUES (?, ?)", 
        (username, email)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    
    return {"status": "created", "user_id": user_id}
`
  },
  2: {
    title: "02 Apply Memory",
    fileName: "order_service.py",
    language: "python",
    memoryEnabled: true,
    hint: "Follow-up PR: Different developer submits similar direct DB code. Hindsight recalls the established convention and enforces it.",
    code: `from fastapi import APIRouter, HTTPException
import sqlite3

router = APIRouter()

@router.post("/orders/checkout")
def checkout_cart(cart_id: str, user_id: str, amount: float):
    # Notice: Another developer accessing database directly in the controller
    db = sqlite3.connect("production.db")
    cur = db.cursor()
    
    cur.execute(
        "INSERT INTO orders (cart_id, user_id, total) VALUES (?, ?, ?)",
        (cart_id, user_id, amount)
    )
    db.commit()
    order_id = cur.lastrowid
    db.close()
    
    return {"order_id": order_id, "amount": amount, "status": "paid"}
`
  },
  3: {
    title: "03 Compare Baseline",
    fileName: "order_service.py",
    language: "python",
    memoryEnabled: false,
    hint: "Baseline Mode: Same code reviewed WITHOUT Hindsight memory. Demonstrates generic isolated advice.",
    code: `from fastapi import APIRouter, HTTPException
import sqlite3

router = APIRouter()

@router.post("/orders/checkout")
def checkout_cart(cart_id: str, user_id: str, amount: float):
    # Notice: Another developer accessing database directly in the controller
    db = sqlite3.connect("production.db")
    cur = db.cursor()
    
    cur.execute(
        "INSERT INTO orders (cart_id, user_id, total) VALUES (?, ?, ?)",
        (cart_id, user_id, amount)
    )
    db.commit()
    order_id = cur.lastrowid
    db.close()
    
    return {"order_id": order_id, "amount": amount, "status": "paid"}
`
  }
};

export default function App() {
  const [code, setCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [activeFileName, setActiveFileName] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [activeDemoStep, setActiveDemoStep] = useState(null);
  
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
  
  // UI Panels & Filters
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

  const selectDemoStep = (stepNumber) => {
    setActiveDemoStep(stepNumber);
    const step = DEMO_STEPS[stepNumber];
    setCode(step.code);
    setActiveFileName(step.fileName);
    setSelectedLanguage(step.language);
    setMemoryEnabled(step.memoryEnabled);
    setReviewResult(null);
    setReviewLatency(null);
    setDetectedLanguage("");
  };

  const handleClear = () => {
    setCode("");
    setActiveFileName("");
    setReviewResult(null);
    setActiveDemoStep(null);
    setDetectedLanguage("");
    setReviewLatency(null);
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

  // Severity Counts
  const findingsList = reviewResult?.findings || [];
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
                Codebase Memory
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

      {/* 2. Secondary Sub-Toolbar: Compact 3-Step Interactive Tour */}
      <div className="h-[38px] min-h-[38px] w-full bg-[#080b12] border-b border-white/[0.06] px-4 sm:px-6 flex items-center justify-between z-20 shrink-0 text-xs">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 select-none">
            DEMO
          </span>
          <div className="h-3 w-[1px] bg-white/[0.08] shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => selectDemoStep(1)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                activeDemoStep === 1
                  ? 'bg-violet-600/25 text-violet-200 border border-violet-500/50 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full text-[9px] font-mono flex items-center justify-center ${
                activeDemoStep === 1 ? 'bg-violet-500 text-white' : 'bg-slate-800 text-slate-400 border border-white/[0.08]'
              }`}>1</span>
              <span>Establish Convention</span>
            </button>
            <span className="text-slate-600 text-xs select-none">→</span>
            <button
              onClick={() => selectDemoStep(2)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                activeDemoStep === 2
                  ? 'bg-teal-600/25 text-teal-200 border border-teal-500/50 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full text-[9px] font-mono flex items-center justify-center ${
                activeDemoStep === 2 ? 'bg-teal-400 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 border border-white/[0.08]'
              }`}>2</span>
              <span>Apply Memory</span>
            </button>
            <span className="text-slate-600 text-xs select-none">→</span>
            <button
              onClick={() => selectDemoStep(3)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                activeDemoStep === 3
                  ? 'bg-slate-700/60 text-slate-100 border border-white/[0.2] font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full text-[9px] font-mono flex items-center justify-center ${
                activeDemoStep === 3 ? 'bg-slate-300 text-slate-900 font-bold' : 'bg-slate-800 text-slate-400 border border-white/[0.08]'
              }`}>3</span>
              <span>Compare Baseline</span>
            </button>
          </div>
        </div>

        {/* Compact Right-Side Context Display */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400 truncate pl-3">
          {activeDemoStep ? (
            <div className="flex items-center gap-1.5 truncate" title={DEMO_STEPS[activeDemoStep]?.hint}>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span className="font-semibold text-slate-300">Scenario {activeDemoStep}:</span>
              <span className="text-slate-400 truncate">{DEMO_STEPS[activeDemoStep]?.hint}</span>
            </div>
          ) : (
            <span className="text-slate-500 italic">Select a scenario to populate demo code, or paste custom code</span>
          )}
        </div>
      </div>

      {/* Main Framed Split View (Left: Editor | Right: Review) */}
      <main className="flex-1 min-h-0 w-full p-2 sm:p-3 gap-2 sm:gap-3 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Monaco Code Editor */}
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
              <div className="absolute top-4 left-14 pointer-events-none z-10 flex flex-col font-mono text-[12.5px] text-slate-500/80 select-none space-y-1">
                <p># Paste code here to review</p>
                <p># Or choose a scenario from the Demo Tour above.</p>
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
              {reviewResult && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs border-l border-white/[0.08] pl-2">
                  <span className="font-bold text-slate-300">
                    {reviewResult.findings.length} Issue{reviewResult.findings.length === 1 ? '' : 's'}
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

          {/* 2. Compact Hindsight Memory Context Strip */}
          {reviewResult && (
            <div className={`mx-3 mt-2.5 p-2.5 rounded-lg border text-xs shrink-0 transition-all ${
              reviewResult.review_mode === 'memory_informed'
                ? 'bg-teal-950/20 border-teal-500/30 text-teal-200'
                : 'bg-slate-900/60 border-white/[0.06] text-slate-400'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain
                    size={14}
                    className={reviewResult.review_mode === 'memory_informed' ? 'text-teal-400' : 'text-slate-500'}
                  />
                  <span className="font-semibold text-slate-200">
                    {reviewResult.review_mode === 'memory_informed'
                      ? `Hindsight: ${reviewResult.memories_retrieved.length} relevant team convention(s) applied`
                      : 'Baseline Mode: Generic review — no team memory supplied'}
                  </span>
                </div>
                {reviewResult.memories_retrieved?.length > 0 && (
                  <button
                    onClick={() => setShowMemoryContext(!showMemoryContext)}
                    className="text-[11px] text-teal-400 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <span>{showMemoryContext ? 'Hide' : 'View context'}</span>
                    <ChevronDown size={11} className={`transition-transform ${showMemoryContext ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {showMemoryContext && reviewResult.memories_retrieved?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-teal-500/20 space-y-1">
                  {reviewResult.memories_retrieved.map((m, idx) => (
                    <div key={idx} className="text-[11px] text-teal-300/90 font-mono bg-teal-950/40 p-1.5 rounded border border-teal-500/20">
                      • {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Interactive Filter Tabs */}
          {reviewResult && (
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
          )}

          {/* 4. Scrollable Compact Finding Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {/* Empty Awaiting Submission State */}
            {!reviewResult && !isReviewing && (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <div className="w-10 h-10 rounded-xl bg-[#0f1320] border border-white/[0.07] flex items-center justify-center mb-3 text-slate-400 shadow-inner">
                  <span className="text-sm text-slate-400 font-mono">◇</span>
                </div>
                <h3 className="text-slate-200 font-bold text-xs uppercase tracking-wider mb-1.5">
                  No Review Yet
                </h3>
                <p className="text-[11.5px] max-w-xs text-slate-400 leading-relaxed">
                  Paste code or choose a demo scenario above to begin the review.
                </p>
              </div>
            )}

            {/* In-Progress Loading State */}
            {isReviewing && (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400 animate-pulse shadow-sm">
                  <Brain size={24} />
                </div>
                <h3 className="text-slate-200 font-bold text-xs">Analyzing Code & Consulting Memory...</h3>
                <div className="text-[11px] text-slate-400 max-w-xs space-y-1 font-mono">
                  <p>1. Parsing syntax & detecting language...</p>
                  <p>2. Querying Hindsight persistent bank...</p>
                  <p>3. Synthesizing team-specific review...</p>
                </div>
              </div>
            )}

            {/* Finding Cards List */}
            {reviewResult && !isReviewing && (
              <>
                {displayedFindings.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No findings matching this filter.
                  </div>
                ) : (
                  displayedFindings.map((f) => {
                    const isAccepted = acceptedFindings.has(f.id);
                    const isHigh = f.severity === 'high';
                    const isMed = f.severity === 'medium';
                    const isExpanded = expandedDetails.has(f.id);

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
                            {/* Strict Semantic Severity Badges */}
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

                            {/* Distinct Teal Badge for Memory-Informed Findings */}
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
              </>
            )}

            {/* 5. "Why Hindsight Matters" Collapsible Box */}
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
                title="Clear all stored memories for a clean demo"
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
