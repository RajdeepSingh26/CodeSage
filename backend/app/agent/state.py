from typing import TypedDict, List, Optional, Dict, Any

class EngramState(TypedDict, total=False):
    # User Inputs
    code: str
    file_name: Optional[str]
    language: str
    bank_id: str
    bypass_memory: bool

    # Agent Pipeline State
    detected_language: str
    memories: List[str]
    analysis_findings: List[Dict[str, Any]]
    security_findings: List[Dict[str, Any]]
    all_findings: List[Dict[str, Any]]

    # Proposed Fix & AST Validation Loop
    fixed_code: str
    diff: str
    fix_explanation: str
    validation_status: str  # "passed", "failed", "retried_and_fixed", "warning"
    validation_errors: List[str]
    validation_checks: List[str]
    iteration_count: int
    max_iterations: int

    # Final Synthesis & Observability
    summary: str
    review_mode: str
    timeline: List[Dict[str, Any]]
