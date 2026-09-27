import time
import logging
from typing import Dict, Any, List
from app.agent.state import EngramState

logger = logging.getLogger("engram.agent.final_review")

def final_review_node(state: EngramState) -> Dict[str, Any]:
    """Node 6: Final Review synthesis — unifies findings, diff, and memory citations."""
    start_time = time.perf_counter()
    analysis_findings = state.get("analysis_findings") or []
    sec_findings = state.get("security_findings") or []
    memories = state.get("memories") or []

    # Merge findings avoiding duplicate titles
    combined_findings: List[Dict[str, Any]] = []
    seen_titles = set()

    # Add analysis findings first
    for f in analysis_findings:
        title_key = f.get("title", "").strip().lower()
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            combined_findings.append(f)

    # Add security findings
    for f in sec_findings:
        title_key = f.get("title", "").strip().lower()
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            combined_findings.append(f)

    # Renumber IDs cleanly
    for idx, f in enumerate(combined_findings):
        f["id"] = f"finding-{idx+1}"

    # Determine mode
    has_memory_cited = any(f.get("memory_used") for f in combined_findings)
    review_mode = "memory_informed" if has_memory_cited or len(memories) > 0 else "baseline_no_memory"

    summary = state.get("summary") or "Code review completed successfully."
    if review_mode == "memory_informed" and "memory" not in summary.lower():
        summary += f" Applied {len(memories)} persistent team convention(s) from Hindsight."

    duration_ms = int((time.perf_counter() - start_time) * 1000)

    timeline_event = {
        "step_id": "step-final-review",
        "node_name": "final_review_node",
        "title": "Review Synthesis & Packaging",
        "description": f"Consolidated {len(combined_findings)} verified findings and unified diff",
        "status": "completed",
        "duration_ms": duration_ms,
        "details": {
            "total_findings": len(combined_findings),
            "review_mode": review_mode
        }
    }

    existing_timeline = list(state.get("timeline") or [])
    existing_timeline.append(timeline_event)

    return {
        "all_findings": combined_findings,
        "summary": summary,
        "review_mode": review_mode,
        "timeline": existing_timeline
    }
