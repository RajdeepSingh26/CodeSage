# Engram
> **"An AI Code Review Agent That Learns Your Team"**  
> *Built for HackWithHyderabad 3.0*

[![Hindsight Powered](https://img.shields.io/badge/Memory-Hindsight%20Cloud-10b981?style=for-the-badge&logo=brain)](https://vectorize.io)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Monaco-61dafb?style=for-the-badge&logo=react)](https://react.dev)
[![Gemini](https://img.shields.io/badge/LLM-Google%20Gemini%20Flash-8e75ff?style=for-the-badge&logo=google)](https://ai.google.dev)

---

## 🌟 Overview & Core Idea

Traditional AI code review tools treat every code snippet in complete isolation. They offer generic advice, repeatedly report issues that the team has already discussed, and fail to adapt to a company's specific engineering culture and architectural rules.

**Engram** transforms code review by embedding **Hindsight**—an agentic persistent memory system—directly into the review lifecycle. Rather than acting as a static bot, our agent evolves alongside your engineering team:

* **WITHOUT MEMORY:** `Code` ➔ Generic AI review (repeating the same generic suggestions).
* **WITH HINDSIGHT:** `Code` ➔ Retrieve relevant team memory ➔ Context-aware review actively citing established team conventions and prior review decisions.

> **The Central Value Proposition:**  
> *"Generic AI reviews code. Engram learns how YOUR team reviews code."*

---

## 🏆 Hackathon Judging Criteria Alignment

| Criterion | Weight | How Engram Delivers |
| :--- | :---: | :--- |
| **Innovation** | **30%** | Solves the LLM "statelessness" problem in software engineering. Transforms AI code review from an isolated prompt into a self-improving institutional memory layer. |
| **Hindsight Memory** | **25%** | **Deep, official integration**: Uses Hindsight Cloud (`hindsight-client`) with explicit `retain()`, `recall()`, memory networks (`world`, `observation`), and bank isolation. Memory is central to every review decision. |
| **Technical Implementation** | **20%** | Production-ready FastAPI architecture with strict Pydantic schemas, resilient error handling, Monaco Editor integration, and 100% passing automated test suite. |
| **User Experience** | **15%** | Modern developer console featuring interactive demo steps, live Hindsight memory bank inspector, memory toggle for instant A/B comparison, and one-click feedback acceptance. |
| **Real-world Impact** | **10%** | Prevents architectural drift across large engineering organizations, onboard new engineers faster, and stops teams from debating the same conventions across multiple PRs. |

---

## 🧠 How Hindsight Is Used

Hindsight operates as the durable memory layer behind the agent:

1. **`hindsight.retain(bank_id, content, metadata)`**:
   When a developer **Accepts** or **Rejects** review feedback, the agent converts that interaction into a durable engineering rule (e.g., *"Team Convention [architecture]: All SQL queries must be placed in repository classes, never in API route handlers"*). Hindsight automatically extracts entities, indexes the knowledge, and synthesizes higher-order observations.
2. **`hindsight.recall(bank_id, query, budget)`**:
   Before every review, the agent queries Hindsight using the incoming code context. Relevant team rules, conventions, and past architectural decisions are retrieved and injected into the LLM context.
3. **Citation & Explainability**:
   Findings informed by memory explicitly display a **`🧠 Learned Team Convention`** badge with direct quotation of the team memory, giving developers transparency into *why* the suggestion was made.
4. **Memory Bank Partitioning**:
   Each team or repository has its own isolated `bank_id`, allowing multi-repository support and clean one-click resets during live judging demonstrations.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Frontend ["Frontend (Vite + React + Monaco Editor)"]
        UI["Code Editor & Review Console"]
        Tour["Demo Tour Selector (Step 1, 2, 3)"]
        Inspector["Live Hindsight Memory Inspector"]
        Toggle["Memory Layer Toggle (A/B Test)"]
    end

    subgraph Backend ["Backend (FastAPI Server)"]
        API["REST API Router"]
        HindsightService["Hindsight Service (Connection Manager)"]
        LLMService["LLM Review Engine (Gemini / Groq)"]
    end

    subgraph MemoryLayer ["Hindsight Cloud (Vectorize.io)"]
        MemoryBank[("Team Memory Bank\n(codebase-memory-team-default)")]
        Networks["World • Experience • Observation"]
    end

    subgraph AIProvider ["Google GenAI"]
        GeminiFlash["Gemini Flash Engine"]
    end

    Tour -->|Load Sample PR| UI
    UI -->|1. POST /api/review| API
    Toggle -.->|Bypass flag| API
    API -->|2. recall(query)| HindsightService
    HindsightService -->|Query Bank| MemoryBank
    MemoryBank -->|3. Retrieved Team Conventions| HindsightService
    HindsightService -->|Memories| LLMService
    LLMService -->|4. Prompt: Code + Team Memories| GeminiFlash
    GeminiFlash -->|5. Structured Review JSON| LLMService
    LLMService -->|6. Findings with Citations| UI
    UI -->|7. Accept/Reject Decision| API
    API -->|8. retain(rule, metadata)| HindsightService
    HindsightService -->|Persist New Convention| MemoryBank
    MemoryBank -->|9. Real-time updates| Inspector
```

---

## ⚡ 60-Second Live Demo Script (For Judges)

The UI includes a built-in **Demo Tour** bar at the top:

### **Step 1: First Review (Baseline)**
1. Click **`Step 1: First PR (Establish Convention)`** in the Demo Tour.
2. Notice the code in `user_service.py`: a developer is writing direct SQLite queries in an API route.
3. Click **Submit for Review**.
4. The AI returns a standard review: *"Database access should be separated into a repository layer."*
5. Click **✓ Accept as Team Convention** on the finding.
   * *Confetti fires!*
   * Look at the **Team Memory Bank** on the right: the rule is now permanently stored in Hindsight Cloud!

### **Step 2: Second Review (Memory in Action)**
1. Click **`Step 2: Second PR (Hindsight In Action!)`**.
2. Notice this is a completely different file (`order_service.py`) written by another developer, with similar direct DB access.
3. Click **Submit for Review**.
4. **The Difference:** The review immediately displays a glowing green banner:
   * **`🧠 INFORMED BY HINDSIGHT TEAM MEMORY`**
   * The finding has a **Learned Convention** badge citing:  
     `"Team Convention Applied: All database access and SQL queries must be performed through the Repository layer..."`
5. Switch the **Persistent Memory Layer** toggle to **BASELINE ONLY** and re-run. Show the judge that without memory, the agent returns only generic advice without team context.

---

## 🚀 Setup & Installation

### Prerequisites
* **Python 3.10+**
* **Node.js v18+ & npm**
* **Hindsight Cloud Account & API Key** ([vectorize.io](https://vectorize.io))
* **Gemini API Key** ([Google AI Studio](https://aistudio.google.com/)) or Groq API Key

### 1. Clone & Environment Configuration
```bash
git clone <repo-url>
cd Code_Review_Agent

# Copy example environment configuration
cp .env.example .env
```

Open `.env` and fill in your keys:
```ini
HINDSIGHT_API_KEY=your_hindsight_api_key
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_BANK_ID=codebase-memory-team-default

LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

### 2. Backend Setup
```bash
# Activate virtual environment
.\.venv\Scripts\activate   # Windows
# or: source .venv/bin/activate  # macOS/Linux

# Install requirements
pip install -r backend/requirements.txt

# Run backend test suite
pytest backend/tests/test_backend.py
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build
cd ..
```

---

## 🏃 Running the Application

### Option A: Quickstart Launcher (Windows)
Double-click **`start_demo.bat`** or run:
```powershell
.\start_demo.bat
```
This automatically starts both the FastAPI backend and the React frontend and opens your browser to `http://localhost:5173`.

### Option B: Manual Execution
**Terminal 1 (Backend):**
```bash
python run_backend.py
# Running on http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

---

## 🧪 Automated Test Verification

Run the comprehensive pytest suite verifying health, mock reviews, and the live Hindsight memory retention/recall cycle:
```bash
pytest backend/tests/test_backend.py -v
```
All 4 test suites validate:
* `test_health`: Service heartbeat and configuration check.
* `test_get_scenarios`: Synthetic demo scenarios payload integrity.
* `test_review_endpoint_bypass_memory`: Clean baseline review execution without memory.
* `test_hindsight_decision_and_memory_review`: End-to-end Hindsight retention, memory bank listing, semantic recall, and memory-informed Gemini review.

---

## 👥 HackWithHyderabad 3.0 Team

* **Virat** — Team Leader & Architect
* **Rajdeep** — Lead Software Engineer & AI Integration
* **Kunal** — Backend & Infrastructure Engineer
* **Kushan** — Product Design & Presentation
* **Gurnoor** — Content, Video & Documentation

---

## 🔮 Future Roadmap

* **GitHub App / PR Webhook Integration:** Run Engram automatically on every GitHub Pull Request.
* **IDE Extension:** Inline VS Code diagnostics highlighting team convention conflicts as you type.
* **Cross-Repo Memory Sync:** Share architectural conventions across multiple microservice repositories within an organization.
* **Multi-Modal Architecture Reviews:** Retain diagrams, RFC links, and architecture decision records (ADRs) into Hindsight.
