import time
import logging
from typing import Dict, Any, List
from app.agent.state import EngramState
from app.services.llm_service import llm_service

logger = logging.getLogger("engram.agent.security")

SECURITY_SYSTEM_PROMPT = """You are the Senior Security Agent for Engram, an elite AI engineering system.
Your sole focus is identifying security vulnerabilities, secrets leakage, injection flaws, authentication errors, and unsafe configurations.

INSTRUCTIONS:
1. Examine the submitted code and proposed fix for security risks:
   - Injection (SQL, Command, LDAP, Template)
   - Hardcoded credentials, secrets, tokens, or private keys
   - Insecure deserialization (eval, pickle, unsafe YAML)
   - Broken authorization or missing authentication guards
   - Unsanitized inputs, SSRF, XSS
2. If vulnerabilities exist, output structured findings with severity 'high' or 'medium'.
3. If the code is secure, return an empty findings list [].

OUTPUT JSON ONLY:
{
  "security_summary": "1 sentence security verdict",
  "security_findings": [
    {
      "id": "sec-1",
      "severity": "high" | "medium" | "low" | "info",
      "category": "security",
      "title": "Specific Security Vulnerability",
      "description": "Exploit mechanism and blast radius",
      "suggestion": "Cryptographic or sanitization remediation",
      "memory_used": false,
      "memory_citation": null
    }
  ]
}
"""

def security_node(state: EngramState) -> Dict[str, Any]:
    """Node 5: Dedicated security, injection, and credential leak scan."""
    start_time = time.perf_counter()
    code = state.get("code", "")
    fixed_code = state.get("fixed_code", "")
    file_name = state.get("file_name") or "snippet"
    lang = state.get("detected_language") or "plaintext"

    user_content = f"""### FILE: {file_name} ({lang})
### ORIGINAL CODE:
```{lang}
{code}
```

### PROPOSED FIXED CODE:
```{lang}
{fixed_code}
```

Audit both codes for security vulnerabilities. Output the JSON object."""

    result = llm_service.call_llm_json(user_content=user_content, system_prompt=SECURITY_SYSTEM_PROMPT)

    security_findings: List[Dict[str, Any]] = []
    sec_summary = "Security audit completed."

    if result:
        sec_summary = result.get("security_summary") or sec_summary
        for idx, f in enumerate(result.get("security_findings") or []):
            security_findings.append({
                "id": f.get("id", f"sec-{idx+1}"),
                "severity": f.get("severity", "high"),
                "category": "security",
                "title": f.get("title", "Security Vulnerability"),
                "description": f.get("description", ""),
                "suggestion": f.get("suggestion", ""),
                "memory_used": False,
                "memory_citation": None
            })

    duration_ms = int((time.perf_counter() - start_time) * 1000)

    timeline_event = {
        "step_id": "step-security",
        "node_name": "security_node",
        "title": "Security & Vulnerability Audit",
        "description": f"Identified {len(security_findings)} security item(s)" if security_findings else "Clean security scan (0 critical vulnerabilities detected)",
        "status": "completed",
        "duration_ms": duration_ms,
        "details": {
            "security_findings_count": len(security_findings),
            "verdict": sec_summary
        }
    }

    existing_timeline = list(state.get("timeline") or [])
    existing_timeline.append(timeline_event)

    return {
        "security_findings": security_findings,
        "timeline": existing_timeline
    }
