import time
import logging
from typing import Dict, Any, List
from app.agent.state import EngramState
from app.services.llm_service import llm_service

logger = logging.getLogger("engram.agent.analysis")

ANALYSIS_SYSTEM_PROMPT = """You are the Senior Analysis Agent for Engram, an elite AI engineering system.
Your job is to inspect source code and detect bugs, architectural violations, convention breaches, and performance issues.

INSTRUCTIONS:
1. Detect canonical lowercase language (e.g. python, typescript, javascript, go, rust, java, csharp, cpp, php, sql, shell, etc.).
2. Evaluate against RETRIEVED TEAM MEMORIES:
   - If team memories exist, prioritize them and cite them.
   - Set memory_used to true and memory_citation to the exact rule remembered.
3. Categorize findings strictly as one of:
   - architecture, convention, bug, testing, style, security

OUTPUT JSON ONLY:
{
  "detected_language": "string",
  "summary": "1-2 sentence executive summary of findings",
  "findings": [
    {
      "id": "finding-1",
      "severity": "high" | "medium" | "low" | "info",
      "category": "architecture" | "convention" | "bug" | "testing" | "style",
      "title": "Clear concise title",
      "description": "Thorough explanation of why this is problematic",
      "suggestion": "Actionable fix or refactoring advice",
      "memory_used": true | false,
      "memory_citation": "Quote/summary of team convention, or null"
    }
  ]
}
"""

def analysis_node(state: EngramState) -> Dict[str, Any]:
    """Node 2: Performs multi-perspective code analysis and team convention verification."""
    start_time = time.perf_counter()
    code = state.get("code", "")
    file_name = state.get("file_name") or "snippet"
    language = state.get("language") or "auto"
    memories = state.get("memories") or []

    memory_section = ""
    if memories:
        memory_section = "### RETRIEVED TEAM CONVENTIONS FROM HINDSIGHT:\n" + "\n".join(
            f"- [Memory {i+1}]: {mem}" for i, mem in enumerate(memories)
        )
    else:
        memory_section = "### RETRIEVED TEAM CONVENTIONS FROM HINDSIGHT:\n(No relevant memories. Baseline review.)"

    user_content = f"""{memory_section}

### FILE: {file_name} (Specified: {language})
### CODE TO ANALYZE:
```{language}
{code}
```

Perform deep code analysis and output the requested JSON object."""

    result = llm_service.call_llm_json(user_content=user_content, system_prompt=ANALYSIS_SYSTEM_PROMPT)

    detected_lang = "plaintext"
    summary = "Code analysis completed."
    findings: List[Dict[str, Any]] = []

    if result:
        detected_lang = result.get("detected_language") or (language if language != "auto" else "plaintext")
        summary = result.get("summary") or summary
        raw_findings = result.get("findings") or []
        for idx, f in enumerate(raw_findings):
            findings.append({
                "id": f.get("id", f"finding-{idx+1}"),
                "severity": f.get("severity", "medium"),
                "category": f.get("category", "convention"),
                "title": f.get("title", "Review Finding"),
                "description": f.get("description", ""),
                "suggestion": f.get("suggestion", ""),
                "memory_used": bool(f.get("memory_used", False)),
                "memory_citation": f.get("memory_citation")
            })

    duration_ms = int((time.perf_counter() - start_time) * 1000)

    timeline_event = {
        "step_id": "step-analysis",
        "node_name": "analysis_node",
        "title": "Code & Convention Analysis",
        "description": f"Identified {len(findings)} findings across architecture and team conventions",
        "status": "completed",
        "duration_ms": duration_ms,
        "details": {
            "detected_language": detected_lang,
            "findings_count": len(findings)
        }
    }

    existing_timeline = list(state.get("timeline") or [])
    existing_timeline.append(timeline_event)

    return {
        "detected_language": detected_lang,
        "analysis_findings": findings,
        "summary": summary,
        "timeline": existing_timeline
    }
