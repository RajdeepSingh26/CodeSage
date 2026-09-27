import ast
import time
import logging
from typing import Dict, Any, List
from app.agent.state import EngramState

logger = logging.getLogger("engram.agent.validation")

def check_balanced_delimiters(code: str) -> List[str]:
    """Basic structural sanity check for delimiters across any language."""
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    errors = []
    
    # Simple scanner ignoring string contents
    in_single_str = False
    in_double_str = False
    escaped = False
    
    for idx, ch in enumerate(code):
        if escaped:
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            continue
        if ch == "'" and not in_double_str:
            in_single_str = not in_single_str
            continue
        if ch == '"' and not in_single_str:
            in_double_str = not in_double_str
            continue
        if in_single_str or in_double_str:
            continue
            
        if ch in pairs.values():
            stack.append((ch, idx))
        elif ch in pairs:
            if not stack:
                errors.append(f"Unmatched closing delimiter '{ch}' near character index {idx}")
                break
            top, _ = stack.pop()
            if top != pairs[ch]:
                errors.append(f"Mismatched delimiter: expected closing for '{top}' but found '{ch}'")
                break
                
    if stack and len(errors) == 0:
        unclosed = [s[0] for s in stack[-3:]]
        errors.append(f"Unclosed delimiter(s): {', '.join(unclosed)}")
        
    return errors

def validation_node(state: EngramState) -> Dict[str, Any]:
    """Node 4: Validates syntax, AST integrity, and completeness of the proposed fix."""
    start_time = time.perf_counter()
    fixed_code = state.get("fixed_code", "")
    original_code = state.get("code", "")
    lang = (state.get("detected_language") or state.get("language") or "").lower()
    iteration = state.get("iteration_count", 1)
    max_iterations = state.get("max_iterations", 2)

    errors: List[str] = []
    checks: List[str] = []

    # Check 1: Completeness check
    if not fixed_code.strip():
        errors.append("Proposed fix is completely empty.")
    elif len(fixed_code) < len(original_code) * 0.2 and len(original_code) > 100:
        errors.append("Proposed fix appears truncated or missing original functionality.")
    else:
        checks.append("Code completeness check passed")

    # Check 2: Truncation placeholder check
    placeholder_triggers = ["// ... rest of code", "# ... rest of code", "/* ... */"]
    for placeholder in placeholder_triggers:
        if placeholder in fixed_code:
            errors.append(f"Proposed fix contains unfinished placeholder comment: '{placeholder}'")

    # Check 3: Language-specific AST check
    if "python" in lang or (not lang and "def " in fixed_code and ":" in fixed_code):
        try:
            ast.parse(fixed_code)
            checks.append("Python AST syntax check passed (0 syntax errors)")
        except SyntaxError as e:
            errors.append(f"Python SyntaxError at line {e.lineno}: {e.msg}")
    else:
        # Check delimiters for other languages (JS, TS, Go, C#, Java, etc.)
        delimit_errors = check_balanced_delimiters(fixed_code)
        if delimit_errors:
            errors.extend(delimit_errors)
        else:
            checks.append(f"Structural delimiter integrity verified for {lang or 'source'}")

    # Determine status & routing
    if errors:
        if iteration < max_iterations:
            status = "failed"
            logger.info(f"Validation failed on iteration {iteration}. Routing back to Fix Agent: {errors}")
        else:
            status = "warning"
            logger.warning(f"Validation warnings on iteration {iteration} after max retries: {errors}")
    else:
        status = "retried_and_fixed" if iteration > 1 else "passed"
        checks.append("All automated validation rules passed")

    duration_ms = int((time.perf_counter() - start_time) * 1000)

    timeline_event = {
        "step_id": f"step-validate-{iteration}",
        "node_name": "validation_node",
        "title": f"Fix Validation & Syntax Verification (Iter {iteration})" if iteration > 1 else "Fix Validation & Syntax Verification",
        "description": "Validation passed with clean AST parsing" if status in ["passed", "retried_and_fixed"] else f"Detected {len(errors)} validation issue(s); initiating fix refinement loop",
        "status": "completed" if status in ["passed", "retried_and_fixed", "warning"] else "retrying",
        "duration_ms": duration_ms,
        "details": {
            "validation_status": status,
            "errors": errors,
            "checks": checks,
            "iteration": iteration
        }
    }

    existing_timeline = list(state.get("timeline") or [])
    existing_timeline.append(timeline_event)

    return {
        "validation_status": status,
        "validation_errors": errors,
        "validation_checks": checks,
        "timeline": existing_timeline
    }
