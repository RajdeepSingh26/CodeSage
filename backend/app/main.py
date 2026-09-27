import logging
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import (
    ReviewRequest,
    ReviewResponse,
    DecisionRequest,
    DecisionResponse,
    BankStatusResponse
)
from app.services.hindsight_service import hindsight_service
from app.services.llm_service import llm_service
from app.agent import run_engram_pipeline
from app.demo_scenarios import DEMO_SCENARIOS

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("engram")

app = FastAPI(
    title="Engram API",
    description="An AI Code Review Agent That Learns Your Team with Persistent Hindsight Memory",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "Engram",
        "orchestration": "LangGraph (StateGraph with AST validation retry loops)",
        "pipeline_stages": ["recall", "analysis", "fix", "validate", "security", "final_review"],
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.GEMINI_MODEL,
        "hindsight_bank": settings.HINDSIGHT_BANK_ID,
        "hindsight_connected": bool(settings.HINDSIGHT_API_KEY)
    }

@app.get("/api/scenarios")
def get_scenarios():
    return DEMO_SCENARIOS

@app.get("/api/memory/list")
def list_team_memories(bank_id: Optional[str] = Query(None)):
    target_bank = bank_id or settings.HINDSIGHT_BANK_ID
    memories = hindsight_service.list_all_memories(bank_id=target_bank)
    return BankStatusResponse(
        bank_id=target_bank,
        count=len(memories),
        memories=memories
    )

@app.post("/api/memory/reset")
def reset_team_memory(bank_id: Optional[str] = Query(None)):
    target_bank = bank_id or settings.HINDSIGHT_BANK_ID
    success = hindsight_service.reset_bank(bank_id=target_bank)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset memory bank")
    return {
        "success": True,
        "bank_id": target_bank,
        "message": f"Hindsight memory bank '{target_bank}' has been reset for a clean demo run."
    }

@app.post("/api/review", response_model=ReviewResponse)
def review_code(req: ReviewRequest):
    target_bank = req.bank_id or settings.HINDSIGHT_BANK_ID
    logger.info(f"Initiating Engram LangGraph review pipeline for target bank '{target_bank}' (bypass_memory={req.bypass_memory})")

    # Run complete LangGraph agentic pipeline
    response = run_engram_pipeline(
        code=req.code,
        file_name=req.file_name,
        language=req.language,
        bank_id=target_bank,
        bypass_memory=req.bypass_memory
    )
    return response

@app.post("/api/decision", response_model=DecisionResponse)
def record_decision(req: DecisionRequest):
    target_bank = req.bank_id or settings.HINDSIGHT_BANK_ID
    
    if req.decision == "accept":
        rule = req.feedback_rule or f"Team Convention [{req.finding_category}]: {req.finding_title}. {req.finding_description}"
        action_desc = "Accepted review feedback and established team convention"
    else:
        rule = req.feedback_rule or f"Team Exception [{req.finding_category}]: Team explicitly rejected '{req.finding_title}'. This pattern is permitted in this context."
        action_desc = "Recorded rejected feedback as recognized team exception"

    success = hindsight_service.retain_rule(
        rule_content=rule,
        category=req.finding_category,
        decision=req.decision,
        bank_id=target_bank,
        context=req.context_code_snippet
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to store decision in Hindsight")

    return DecisionResponse(
        success=True,
        decision=req.decision,
        retained_rule=rule,
        bank_id=target_bank,
        message=f"{action_desc} in persistent Hindsight memory."
    )
