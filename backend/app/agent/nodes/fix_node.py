import difflib
import time
import logging
from typing import Dict, Any
from app.agent.state import EngramState
from app.services.llm_service import llm_service

logger = logging.getLogger("engram.agent.fix")

FIX_SYSTEM_PROMPT = """You are the Fix Generation Agent for Engram, an elite AI engineering system.
Your job is to produce a complete, production-ready replacement for the submitted code that addresses all review findings and strictly honors team conventions.

RULES:
1. Provide the COMPLETE replacement code. Do not omit sections with comments like "// rest of code remains the same".
2. Ensure the code is syntactically valid and runnable.
3. If 'Validation Errors from Previous Iteration' are provided, you MUST correct them directly.
4. Output JSON ONLY conforming strictly to:
{
  "fixed_code": "The complete revised code as a single string",
  "explanation": "Clear bullet points explaining what was changed and why it resolves the findings and matches conventions"
}
"""

def generate_unified_diff(original: str, fixed: str, file_name: str = "code") -> str:
    """Generate a clean unified diff between original and fixed code."""
    orig_lines = original.splitlines(keepends=True)
    fixed_lines = fixed.splitlines(keepends=True)
    diff = difflib.unified_diff(
        orig_lines,
        fixed_lines,
        fromfile=f"a/{file_name}",
        tofile=f"b/{file_name}",
        n=3
    )
    return "".join(diff)

def fix_node(state: EngramState) -> Dict[str, Any]:
    """Node 3: Generates proposed code fix and unified diff."""
    start_time = time.perf_counter()
    original_code = state.get("code", "")
    file_name = state.get("file_name") or "snippet"
    lang = state.get("detected_language") or state.get("language") or "plaintext"
    findings = state.get("analysis_findings") or []
    val_errors = state.get("validation_errors") or []
    iteration = state.get("iteration_count", 0) + 1

    # Findings summary for prompt
    findings_text = "\n".join(
        f"- [{f.get('severity', 'medium').upper()}] {f.get('title')}: {f.get('suggestion')}"
        for f in findings[:6]
    )

    retry_context = ""
    if val_errors:
        retry_context = f"\n### CRITICAL: VALIDATION ERRORS FROM PREVIOUS ITERATION (Must be fixed):\n" + "\n".join(
            f"- {err}" for err in val_errors
        )

    user_content = f"""### FILE: {file_name} ({lang})
### ORIGINAL CODE:
```{lang}
{original_code}
```

### ISSUES TO RESOLVE & CONVENTIONS TO APPLY:
{findings_text or "General cleanup and architectural hardening."}
{retry_context}

Generate the complete corrected code now. Output the JSON object."""

    result = llm_service.call_llm_json(user_content=user_content, system_prompt=FIX_SYSTEM_PROMPT)

    fixed_code = original_code
    explanation = "No code modifications needed."

    if result and result.get("fixed_code"):
        candidate_code = result.get("fixed_code").strip()
        # Clean potential markdown wrapping if LLM included it inside the json string
        if candidate_code.startswith("```"):
            lines = candidate_code.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            candidate_code = "\n".join(lines).strip()
        fixed_code = candidate_code
        explanation = result.get("explanation") or "Applied recommended architectural and convention fixes."

    diff_str = generate_unified_diff(original_code, fixed_code, file_name)
    duration_ms = int((time.perf_counter() - start_time) * 1000)

    title = f"Fix Generation (Iteration {iteration})" if iteration > 1 else "Fix Generation & Diff"
    status_str = "retrying" if val_errors else "completed"

    timeline_event = {
        "step_id": f"step-fix-{iteration}",
        "node_name": "fix_node",
        "title": title,
        "description": f"Generated actionable replacement code and unified diff ({len(diff_str.splitlines())} diff lines)" if diff_str else "Generated clean replacement code matching conventions",
        "status": status_str,
        "duration_ms": duration_ms,
        "details": {
            "iteration": iteration,
            "diff_lines": len(diff_str.splitlines()) if diff_str else 0
        }
    }

    existing_timeline = list(state.get("timeline") or [])
    existing_timeline.append(timeline_event)

    return {
        "fixed_code": fixed_code,
        "diff": diff_str,
        "fix_explanation": explanation,
        "iteration_count": iteration,
        "timeline": existing_timeline
    }
