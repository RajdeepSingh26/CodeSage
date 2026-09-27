import os
import json
import re
import logging
from typing import List, Optional
from google import genai
from google.genai import types

from app.config import settings
from app.schemas import ReviewResponse, ReviewFinding

logger = logging.getLogger("llm_service")

REVIEW_SYSTEM_PROMPT = """You are an elite Senior Staff Engineer and AI Code Review Agent named 'CodeSage'.
Your defining capability is that you LEARN and APPLY your engineering team's historical decisions, conventions, and past review agreements stored in long-term memory.

You accept code in ANY programming language.

REVIEW INSTRUCTIONS:
1. FIRST, identify and detect the exact programming language of the submitted code (e.g. python, typescript, javascript, go, java, csharp, cpp, rust, php, ruby, sql, bash, etc.).
2. Carefully inspect the code for bugs, architectural violations, security risks, error handling, performance bottlenecks, and coding conventions.
3. CRITICAL TEAM MEMORY INTEGRATION:
   * If 'Relevant Team Memories' contains conventions, past decisions, or accepted/rejected feedback that apply to this code, you MUST prioritize and explicitly enforce them!
   * For any finding informed by team memory:
     - Set `memory_used` to true.
     - In `memory_citation`, cite the exact team convention/rule remembered from Hindsight (e.g., "Team Convention: All database access must be performed through the Repository layer.").
     - In `title` and `description`, make it unmistakably clear that this is an established team standard (e.g., "Violates Team Architectural Convention: Direct DB Access").
   * If no relevant team memories apply or the memory list is empty, perform a standard senior engineer baseline review (set `memory_used` to false and `memory_citation` to null).

OUTPUT FORMAT:
You MUST respond with valid JSON adhering strictly to this JSON schema:
{
  "detected_language": "lowercase canonical language name (e.g. python, typescript, javascript, go, rust, java, csharp, cpp, php, sql, etc.)",
  "summary": "High-level review summary (1-3 sentences) noting detected language and whether team conventions were applied",
  "findings": [
    {
      "id": "finding-1",
      "severity": "high" | "medium" | "low" | "info",
      "category": "architecture" | "convention" | "bug" | "security" | "testing" | "style",
      "title": "Short descriptive title",
      "description": "Thorough explanation of the issue and why it matters",
      "suggestion": "Concrete actionable fix or refactored code snippet",
      "memory_used": true | false,
      "memory_citation": "Quote or summary of the specific team memory applied, or null"
    }
  ]
}
"""

class LLMService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.gemini_client = None
        if settings.GEMINI_API_KEY:
            self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def _clean_json_text(self, text: str) -> str:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    def generate_review(
        self,
        code: str,
        file_name: str,
        language: str,
        memories: List[str],
        bank_id: str
    ) -> ReviewResponse:
        # Build prompt
        memory_section = ""
        if memories:
            memory_section = "### RETRIEVED TEAM MEMORIES FROM HINDSIGHT:\n" + "\n".join(
                f"- [Memory {i+1}]: {mem}" for i, mem in enumerate(memories)
            )
        else:
            memory_section = "### RETRIEVED TEAM MEMORIES FROM HINDSIGHT:\n(No relevant past team memories found. This is a clean baseline review.)"

        user_content = f"""{memory_section}

### FILE: {file_name} ({language})
### CODE TO REVIEW:
```{language}
{code}
```

Review this code now. Follow all instructions and output the JSON object."""

        models_to_try = [
            settings.GEMINI_MODEL,
            "gemini-3.5-flash-lite",
            "gemini-2.5-flash"
        ]

        last_error = None
        for model_name in models_to_try:
            try:
                logger.info(f"Attempting review with model: {model_name}")
                response = self.gemini_client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config=types.GenerateContentConfig(
                        system_instruction=REVIEW_SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        temperature=0.2
                    )
                )

                raw_json = self._clean_json_text(response.text)
                data = json.loads(raw_json)

                findings = []
                for idx, f in enumerate(data.get("findings", [])):
                    findings.append(
                        ReviewFinding(
                            id=f.get("id", f"finding-{idx+1}"),
                            severity=f.get("severity", "medium"),
                            category=f.get("category", "convention"),
                            title=f.get("title", "Review Finding"),
                            description=f.get("description", ""),
                            suggestion=f.get("suggestion", ""),
                            memory_used=f.get("memory_used", False),
                            memory_citation=f.get("memory_citation", None)
                        )
                    )

                mode = "memory_informed" if any(f.memory_used for f in findings) or len(memories) > 0 else "baseline_no_memory"

                detected_lang = data.get("detected_language") or (language if language != "auto" else "plaintext")
                
                return ReviewResponse(
                    summary=data.get("summary", "Code review completed successfully."),
                    detected_language=detected_lang,
                    findings=findings,
                    memories_retrieved=memories,
                    review_mode=mode,
                    bank_id=bank_id
                )
            except Exception as e:
                logger.warning(f"Model {model_name} failed: {e}")
                last_error = e

        # Fallback if LLM failed
        return ReviewResponse(
            summary=f"Review generation error: {str(last_error)}",
            detected_language=language if language != "auto" else "plaintext",
            findings=[
                ReviewFinding(
                    id="finding-err",
                    severity="high",
                    category="bug",
                    title="Code Review Failed",
                    description=f"Could not contact LLM provider. Details: {str(last_error)}",
                    suggestion="Please verify your API key and network connection."
                )
            ],
            memories_retrieved=memories,
            review_mode="baseline_no_memory",
            bank_id=bank_id
        )

llm_service = LLMService()
