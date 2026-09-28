import logging
from typing import Optional
from langgraph.graph import StateGraph, START, END

from app.config import settings
from app.schemas import ReviewResponse, ReviewFinding, ProposedFix, TimelineStep
from app.agent.state import EngramState
from app.agent.nodes.recall_node import recall_node
from app.agent.nodes.analysis_node import analysis_node
from app.agent.nodes.fix_node import fix_node
from app.agent.nodes.validation_node import validation_node
from app.agent.nodes.security_node import security_node
from app.agent.nodes.final_review_node import final_review_node

logger = logging.getLogger("engram.agent.graph")

def route_after_validation(state: EngramState) -> str:
    """Conditional router: loops back to fix_node if validation failed and under max retries."""
    val_status = state.get("validation_status")
    iteration = state.get("iteration_count", 1)
    max_iter = state.get("max_iterations", 2)
    
    if val_status == "failed" and iteration < max_iter:
        logger.info(f"LangGraph conditional route: validation failed at iteration {iteration}/{max_iter} -> RETRY FIX")
        return "fix"
    return "security"

def build_engram_graph():
    """Builds and compiles the Engram Agentic Pipeline StateGraph."""
    workflow = StateGraph(EngramState)
    
    # 1. Add Agent Nodes
    workflow.add_node("recall", recall_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("fix", fix_node)
    workflow.add_node("validate", validation_node)
    workflow.add_node("security", security_node)
    workflow.add_node("final_review", final_review_node)
    
    # 2. Add Linear Edges
    workflow.add_edge(START, "recall")
    workflow.add_edge("recall", "analysis")
    workflow.add_edge("analysis", "fix")
    workflow.add_edge("fix", "validate")
    
    # 3. Add Conditional Edge for AST/Syntax Self-Correction Loop
    workflow.add_conditional_edges(
        "validate",
        route_after_validation,
        {
            "fix": "fix",
            "security": "security"
        }
    )
    
    workflow.add_edge("security", "final_review")
    workflow.add_edge("final_review", END)
    
    return workflow.compile()

# Global compiled graph
engram_agent_pipeline = build_engram_graph()

def run_engram_pipeline(
    code: str,
    file_name: Optional[str] = None,
    language: str = "auto",
    bank_id: Optional[str] = None,
    bypass_memory: bool = False
) -> ReviewResponse:
    """Executes the multi-agent pipeline and returns a structured ReviewResponse."""
    target_bank = bank_id or settings.HINDSIGHT_BANK_ID
    
    initial_state: EngramState = {
        "code": code,
        "file_name": file_name,
        "language": language,
        "bank_id": target_bank,
        "bypass_memory": bypass_memory,
        "iteration_count": 0,
        "max_iterations": 2,
        "timeline": []
    }
    
    try:
        final_state = engram_agent_pipeline.invoke(initial_state)
    except Exception as e:
        logger.exception(f"Agent pipeline execution error: {e}")
        # Fallback graceful return
        return ReviewResponse(
            summary=f"Agent pipeline encountered an error: {e}",
            detected_language=language if language != "auto" else "plaintext",
            findings=[
                ReviewFinding(
                    id="finding-err",
                    severity="high",
                    category="bug",
                    title="Pipeline Execution Error",
                    description=f"Engram agent pipeline failed: {str(e)}",
                    suggestion="Please verify network connection and retry."
                )
            ],
            memories_retrieved=[],
            review_mode="baseline_no_memory",
            bank_id=target_bank
        )

    # Convert findings to ReviewFinding models
    findings_models = [
        ReviewFinding(
            id=f.get("id", f"finding-{i+1}"),
            severity=f.get("severity", "medium"),
            category=f.get("category", "convention"),
            title=f.get("title", "Review Finding"),
            description=f.get("description", ""),
            suggestion=f.get("suggestion", ""),
            memory_used=bool(f.get("memory_used", False)),
            memory_citation=f.get("memory_citation")
        )
        for i, f in enumerate(final_state.get("all_findings") or [])
    ]

    # Convert timeline to TimelineStep models
    timeline_models = [
        TimelineStep(
            step_id=t.get("step_id", f"step-{i}"),
            node_name=t.get("node_name", "agent"),
            title=t.get("title", "Agent Step"),
            description=t.get("description", ""),
            status=t.get("status", "completed"),
            duration_ms=t.get("duration_ms", 0),
            details=t.get("details")
        )
        for i, t in enumerate(final_state.get("timeline") or [])
    ]

    # Create ProposedFix model
    proposed_fix = None
    if final_state.get("fixed_code"):
        raw_fix_exp = final_state.get("fix_explanation", "")
        if isinstance(raw_fix_exp, list):
            fix_exp_str = " ".join(str(item) for item in raw_fix_exp)
        elif isinstance(raw_fix_exp, dict):
            fix_exp_str = " ".join(f"{k}: {v}" for k, v in raw_fix_exp.items())
        else:
            fix_exp_str = str(raw_fix_exp) if raw_fix_exp else "Applied recommended architectural and convention fixes."

        proposed_fix = ProposedFix(
            file_name=file_name or "code",
            original_code=code,
            fixed_code=final_state.get("fixed_code", ""),
            diff=final_state.get("diff", ""),
            unified_diff=final_state.get("diff", ""),
            explanation=fix_exp_str,
            validation_status=final_state.get("validation_status", "passed"),
            validation_checks=final_state.get("validation_checks", [])
        )

    return ReviewResponse(
        summary=final_state.get("summary") or "Code review and proposed fix generated.",
        detected_language=final_state.get("detected_language") or (language if language != "auto" else "plaintext"),
        findings=findings_models,
        memories_retrieved=final_state.get("memories") or [],
        review_mode=final_state.get("review_mode") or "baseline_no_memory",
        bank_id=target_bank,
        proposed_fix=proposed_fix,
        timeline=timeline_models,
        pipeline_status="completed",
        retry_count=max(0, final_state.get("iteration_count", 1) - 1)
    )
