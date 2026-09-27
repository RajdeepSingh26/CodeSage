from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class ReviewFinding(BaseModel):
    id: str = Field(description="Unique identifier for the finding, e.g. finding-1")
    severity: Literal["high", "medium", "low", "info"] = Field(description="Severity of the issue")
    category: Literal["architecture", "convention", "bug", "security", "testing", "style"] = Field(
        description="Category of the finding"
    )
    title: str = Field(description="Brief title of the finding")
    description: str = Field(description="Detailed explanation of what was found in the code")
    suggestion: str = Field(description="Concrete recommendation or code replacement")
    memory_used: bool = Field(default=False, description="True if this finding was directly informed by retrieved team memory")
    memory_citation: Optional[str] = Field(
        default=None, 
        description="The specific team memory/convention cited, e.g. 'Team convention: All DB operations must use the Repository layer.'"
    )

class ReviewRequest(BaseModel):
    code: str
    file_name: str = "service.py"
    language: str = "python"
    bank_id: Optional[str] = None
    bypass_memory: bool = False  # Allows testing review without memory for direct comparison!

class ReviewResponse(BaseModel):
    summary: str
    findings: List[ReviewFinding]
    memories_retrieved: List[str] = []
    review_mode: Literal["memory_informed", "baseline_no_memory"] = "baseline_no_memory"
    bank_id: str

class DecisionRequest(BaseModel):
    bank_id: Optional[str] = None
    finding_title: str
    finding_category: str
    finding_description: str
    decision: Literal["accept", "reject"]
    feedback_rule: Optional[str] = None  # User can edit or customize the learned rule text
    context_code_snippet: Optional[str] = None

class DecisionResponse(BaseModel):
    success: bool
    decision: str
    retained_rule: str
    bank_id: str
    message: str

class MemoryItem(BaseModel):
    id: str
    text: str
    category: Optional[str] = "convention"
    timestamp: Optional[str] = None

class BankStatusResponse(BaseModel):
    bank_id: str
    count: int
    memories: List[dict]
