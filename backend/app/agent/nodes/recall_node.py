import time
import logging
from typing import Dict, Any
from app.config import settings
from app.services.hindsight_service import hindsight_service
from app.agent.state import EngramState

logger = logging.getLogger("engram.agent.recall")

def recall_node(state: EngramState) -> Dict[str, Any]:
    """Node 1: Recalls relevant team conventions and past decisions from Hindsight Cloud."""
    start_time = time.perf_counter()
    bypass = state.get("bypass_memory", False)
    target_bank = state.get("bank_id") or settings.HINDSIGHT_BANK_ID
    code = state.get("code", "")
    
    memories = []
    if not bypass:
        query = f"Code review conventions, architectural standards, and team decisions for:\n{code[:400]}"
        try:
            memories = hindsight_service.recall_memories(query=query, bank_id=target_bank)
            logger.info(f"Recalled {len(memories)} memories from Hindsight bank '{target_bank}'")
        except Exception as e:
            logger.warning(f"Error querying Hindsight memories: {e}")
            memories = []
    
    duration_ms = int((time.perf_counter() - start_time) * 1000)
    
    timeline_event = {
        "step_id": "step-recall",
        "node_name": "recall_node",
        "title": "Team Memory Recall",
        "description": f"Retrieved {len(memories)} team conventions from Hindsight memory bank '{target_bank}'" if not bypass else "Bypassed Hindsight memory (Baseline Mode)",
        "status": "completed",
        "duration_ms": duration_ms,
        "details": {
            "bank_id": target_bank,
            "memories_count": len(memories),
            "memories": memories
        }
    }
    
    existing_timeline = list(state.get("timeline") or [])
    existing_timeline.append(timeline_event)
    
    return {
        "memories": memories,
        "timeline": existing_timeline
    }
