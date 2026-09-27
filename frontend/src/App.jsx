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
  Layers,
  BookOpen,
  ArrowRight,
  Database,
  Shield,
  Zap,
  Check,
  AlertTriangle,
  Info
} from 'lucide-react';
import './App.css';

const DEFAULT_SCENARIOS = [
  {
    id: "scenario-1",
    title: "Step 1: First PR (Establish Convention)",
    subtitle: "Direct database access in API layer.",
    file_name: "user_service.py",
    language: "python",
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
  {
    id: "scenario-2",
    title: "Step 2: Second PR (Hindsight In Action!)",
    subtitle: "New developer submits similar direct DB code.",
    file_name: "order_service.py",
    language: "python",
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
  {
    id: "scenario-3",
    title: "Step 3: Security & Exception Standards",
    subtitle: "Hardcoded secret and generic catch block.",
    file_name: "payment_gateway.py",
    language: "python",
    code: `import requests

def process_stripe_payment(card_token: str, amount_cents: int):
    # Hardcoded fallback key and raw try-except block
    API_SECRET = "sk_live_9384209182390123"
    
    try:
        resp = requests.post(
            "https://api.stripe.com/v1/charges",
            headers={"Authorization": f"Bearer {API_SECRET}"},
            data={"amount": amount_cents, "currency": "usd", "source": card_token}
        )
        return resp.json()
    except Exception as e:
        # Generic catch-all masking error details
        print("Payment error occurred:", e)
        return None
`
  }
];

export default function App() {
  const [scenarios, setScenarios] = useState(DEFAULT_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState("scenario-1");
  const [code, setCode] = useState(DEFAULT_SCENARIOS[0].code);
  const [fileName, setFileName] = useState(DEFAULT_SCENARIOS[0].file_name);
  const [language, setLanguage] = useState(DEFAULT_SCENARIOS[0].language);

  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);

  const [memories, setMemories] = useState([]);
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false);
  const [acceptedFindings, setAcceptedFindings] = useState(new Set());
  const [rejectedFindings, setRejectedFindings] = useState(new Set());
  const [isResetting, setIsResetting] = useState(false);
  const [bankId, setBankId] = useState("codebase-memory-team-default");

  // Fetch initial scenarios and memories
  useEffect(() => {
    fetchScenarios();
    fetchMemories();
  }, []);

  const fetchScenarios = async () => {
    try {
      const res = await fetch('/api/scenarios');
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setScenarios(data);
        }
      }
    } catch (err) {
      console.warn("Using fallback default scenarios");
    }
  };

  const fetchMemories = async () => {
    setIsMemoriesLoading(true);
    try {
      const res = await fetch('/api/memory/list');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
        if (data.bank_id) setBankId(data.bank_id);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setIsMemoriesLoading(false);
    }
  };

  const selectScenario = (sc) => {
    setActiveScenarioId(sc.id);
    setCode(sc.code);
    setFileName(sc.file_name);
    setLanguage(sc.language || "python");
    setReviewResult(null);
  };

  const handleReview = async () => {
    setIsReviewing(true);
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          file_name: fileName,
          language,
          bypass_memory: !memoryEnabled
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReviewResult(data);
      } else {
        alert("Review failed. Please check backend logs.");
      }
    } catch (err) {
      alert(`Error calling review API: ${err.message}`);
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
            spread: 60,
            origin: { y: 0.6 }
          });
        } else {
          setRejectedFindings((prev) => new Set(prev).add(finding.id));
        }
        // Refresh memory panel
        setTimeout(fetchMemories, 800);
      }
    } catch (err) {
      alert(`Failed to save decision: ${err.message}`);
    }
  };

  const handleResetBank = async () => {
    if (!window.confirm("Are you sure you want to reset Hindsight memory for a fresh demo run?")) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/memory/reset', { method: 'POST' });
      if (res.ok) {
        setMemories([]);
        setAcceptedFindings(new Set());
        setRejectedFindings(new Set());
        setReviewResult(null);
        alert("Hindsight memory bank reset successfully!");
      }
    } catch (err) {
      alert("Failed to reset memory bank.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo-icon-box">
            <Brain size={20} />
          </div>
          <div className="title-wrap">
            <h1>CODEBASE MEMORY</h1>
            <p>An AI Code Review Agent That Learns Your Team</p>
          </div>
        </div>

        <div className="header-badges">
          <div className="status-pill">
            <span className="status-dot dot-green animate-pulse-slow"></span>
            <span>Hindsight Cloud Connected</span>
          </div>

          <div className="status-pill">
            <span className="status-dot dot-purple"></span>
            <span>Gemini Flash</span>
          </div>

          <button
            onClick={handleResetBank}
            disabled={isResetting}
            className="btn-icon-subtle"
            title="Reset Hindsight bank for a clean demo presentation"
          >
            <RotateCcw size={12} />
            <span>{isResetting ? "Resetting..." : "Reset Bank"}</span>
          </button>
        </div>
      </header>

      {/* Demo Scenario Stepper & Memory Toggle */}
      <div className="scenario-bar">
        <div className="scenario-pills">
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
            Demo Tour:
          </span>
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              onClick={() => selectScenario(sc)}
              className={`scenario-btn ${activeScenarioId === sc.id ? 'active' : ''}`}
            >
              <Zap size={13} color={activeScenarioId === sc.id ? '#a855f7' : '#94a3b8'} />
              <span>{sc.title}</span>
            </button>
          ))}
        </div>

        <div className="toggle-container">
          <span>Persistent Memory Layer:</span>
          <div
            className={`toggle-switch ${memoryEnabled ? 'on' : ''}`}
            onClick={() => setMemoryEnabled(!memoryEnabled)}
            title="Toggle Hindsight memory to compare with/without memory reviews"
          >
            <div className="toggle-slider"></div>
          </div>
          <span style={{ color: memoryEnabled ? '#10b981' : '#ef4444', fontWeight: '700' }}>
            {memoryEnabled ? "HINDSIGHT ON" : "BASELINE ONLY"}
          </span>
        </div>
      </div>

      {/* Main 3-Column IDE Workspace */}
      <main className="main-workspace">
        {/* Left: Code Editor */}
        <section className="panel">
          <div className="panel-header">
            <div className="file-tab">
              <Code2 size={14} color="#38bdf8" />
              <span>{fileName}</span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Language: <strong style={{ color: '#94a3b8' }}>{language.toUpperCase()}</strong>
            </span>
          </div>

          <div className="editor-body">
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || "")}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                automaticLayout: true,
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>

          <div className="panel-footer">
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Press <strong>Submit</strong> to review with active conventions
            </div>
            <button
              onClick={handleReview}
              disabled={isReviewing}
              className="btn-primary"
            >
              {isReviewing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Reviewing with Hindsight...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Submit for Review</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Center: AI Review Findings Console */}
        <section className="review-panel">
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={15} color="#c084fc" />
              <span>AI REVIEW FINDINGS</span>
            </div>
            {reviewResult && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Found: <strong>{reviewResult.findings.length} issues</strong>
              </span>
            )}
          </div>

          <div className="review-content">
            {!reviewResult && !isReviewing && (
              <div className="empty-state">
                <Code2 size={44} strokeWidth={1.2} />
                <h3 style={{ color: '#f1f5f9', fontSize: '15px' }}>Ready for Code Review</h3>
                <p style={{ maxWidth: '340px', fontSize: '12px' }}>
                  Select one of the demo scenarios above or write your own code, then click <strong>Submit for Review</strong>.
                </p>
              </div>
            )}

            {isReviewing && (
              <div className="empty-state">
                <Brain size={48} className="animate-pulse-slow" color="#8b5cf6" />
                <h3 style={{ color: '#f1f5f9', fontSize: '15px' }}>Consulting Hindsight Memory Bank...</h3>
                <p style={{ maxWidth: '320px', fontSize: '12px' }}>
                  Recalling relevant team conventions, past architectural decisions, and accepted review patterns.
                </p>
              </div>
            )}

            {reviewResult && !isReviewing && (
              <>
                {/* Review Mode Banner */}
                <div className={`review-banner ${reviewResult.review_mode === 'memory_informed' ? 'banner-memory memory-glow' : 'banner-baseline'}`}>
                  {reviewResult.review_mode === 'memory_informed' ? (
                    <Brain size={22} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <Zap size={22} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />
                  )}
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: reviewResult.review_mode === 'memory_informed' ? '#34d399' : '#cbd5e1' }}>
                      {reviewResult.review_mode === 'memory_informed'
                        ? "INFORMED BY HINDSIGHT TEAM MEMORY"
                        : "STANDARD BASELINE REVIEW (WITHOUT MEMORY)"}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      {reviewResult.summary}
                    </p>
                    {reviewResult.memories_retrieved && reviewResult.memories_retrieved.length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#6ee7b7' }}>
                        Retrieved {reviewResult.memories_retrieved.length} relevant team convention(s) from Hindsight.
                      </div>
                    )}
                  </div>
                </div>

                {/* Findings List */}
                {reviewResult.findings.map((finding) => {
                  const isAccepted = acceptedFindings.has(finding.id);
                  const isRejected = rejectedFindings.has(finding.id);

                  return (
                    <div
                      key={finding.id}
                      className={`finding-card ${finding.memory_used ? 'memory-active' : ''}`}
                    >
                      <div className="finding-header">
                        <div className="badges-row">
                          <span className={`badge badge-${finding.severity}`}>
                            {finding.severity}
                          </span>
                          <span className="badge badge-category">
                            {finding.category}
                          </span>
                          {finding.memory_used && (
                            <span className="badge memory-tag-badge">
                              🧠 Learned Convention
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="finding-title">{finding.title}</div>

                      {/* Explicit Memory Citation Callout */}
                      {finding.memory_used && finding.memory_citation && (
                        <div className="memory-citation-box">
                          <Brain size={14} color="#10b981" style={{ flexShrink: 0 }} />
                          <div>
                            <strong>Team Convention Applied:</strong> "{finding.memory_citation}"
                          </div>
                        </div>
                      )}

                      <div className="finding-desc">{finding.description}</div>

                      {finding.suggestion && (
                        <div className="finding-suggestion">
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>
                            Actionable Suggestion:
                          </div>
                          <code>{finding.suggestion}</code>
                        </div>
                      )}

                      {/* Accept/Reject Interactive Decision Loop */}
                      <div className="finding-actions">
                        {isAccepted ? (
                          <div className="decision-saved-badge">
                            <CheckCircle2 size={15} color="#10b981" />
                            <span>Accepted & Saved as Team Convention!</span>
                          </div>
                        ) : isRejected ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fb7185', fontSize: '11.5px', fontWeight: '600' }}>
                            <XCircle size={15} color="#fb7185" />
                            <span>Marked as Team Exception</span>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDecision(finding, 'reject')}
                              className="btn-decision btn-reject"
                              title="Reject feedback: Tell the agent this pattern is allowed"
                            >
                              <XCircle size={13} />
                              <span>Reject Exception</span>
                            </button>
                            <button
                              onClick={() => handleDecision(finding, 'accept')}
                              className="btn-decision btn-accept"
                              title="Accept feedback: Persist this convention into Hindsight long-term memory"
                            >
                              <CheckCircle2 size={13} />
                              <span>Accept as Team Convention</span>
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

        {/* Right: Live Hindsight Memory Inspector */}
        <section className="memory-panel">
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={15} color="#10b981" />
              <span>TEAM MEMORY BANK</span>
            </div>
            <button
              onClick={fetchMemories}
              className="btn-icon-subtle"
              title="Refresh memories from Hindsight Cloud"
            >
              <RefreshCw size={11} className={isMemoriesLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          <div style={{ padding: '10px 16px', background: '#0e1424', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: '#94a3b8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Bank ID:</span>
              <strong style={{ color: '#38bdf8' }}>{bankId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Learned Conventions:</span>
              <strong style={{ color: '#34d399' }}>{memories.length} stored rules</strong>
            </div>
          </div>

          <div className="memory-list">
            {memories.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={36} strokeWidth={1.2} />
                <h4 style={{ color: '#e2e8f0', fontSize: '13px' }}>No Team Memories Yet</h4>
                <p style={{ fontSize: '11px' }}>
                  When you accept or reject review feedback, Hindsight stores your decisions as persistent team engineering standards.
                </p>
              </div>
            ) : (
              memories.map((m, idx) => (
                <div key={m.id || idx} className="memory-card">
                  <div className="memory-meta">
                    <span className="fact-badge">
                      {m.fact_type || "convention"}
                    </span>
                    <span>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Stored"}
                    </span>
                  </div>
                  <div className="memory-text">
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
