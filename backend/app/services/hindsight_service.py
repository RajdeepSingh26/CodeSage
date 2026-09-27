import logging
from typing import List, Dict, Any, Optional
from hindsight_client import Hindsight
from app.config import settings

logger = logging.getLogger("hindsight_service")

class HindsightService:
    def __init__(self):
        self.base_url = settings.HINDSIGHT_BASE_URL
        self.api_key = settings.HINDSIGHT_API_KEY
        self.default_bank_id = settings.HINDSIGHT_BANK_ID

    def _client(self) -> Hindsight:
        return Hindsight(base_url=self.base_url, api_key=self.api_key)

    def ensure_bank_exists(self, bank_id: Optional[str] = None) -> str:
        target_bank = bank_id or self.default_bank_id
        with self._client() as client:
            try:
                client.get_bank_config(bank_id=target_bank)
                return target_bank
            except Exception:
                try:
                    client.create_bank(
                        bank_id=target_bank,
                        name=f"Codebase Memory ({target_bank})",
                        mission="Store team software engineering conventions, architectural decisions, and review feedback."
                    )
                    logger.info(f"Created Hindsight memory bank: {target_bank}")
                except Exception as e:
                    logger.warning(f"Error ensuring bank {target_bank}: {e}")
        return target_bank

    def recall_memories(self, query: str, bank_id: Optional[str] = None, budget: str = "mid") -> List[str]:
        target_bank = bank_id or self.default_bank_id
        try:
            self.ensure_bank_exists(target_bank)
            with self._client() as client:
                resp = client.recall(bank_id=target_bank, query=query, budget=budget)
                memories: List[str] = []
                if hasattr(resp, "results") and resp.results:
                    for item in resp.results:
                        txt = getattr(item, "text", str(item)).strip()
                        if txt and txt not in memories:
                            memories.append(txt)
                logger.info(f"Recalled {len(memories)} memories for query: {query[:50]}...")
                return memories
        except Exception as e:
            logger.error(f"Error recalling memories from Hindsight: {e}")
            return []

    def retain_rule(
        self,
        rule_content: str,
        category: str = "convention",
        decision: str = "accept",
        bank_id: Optional[str] = None,
        context: Optional[str] = None
    ) -> bool:
        target_bank = bank_id or self.default_bank_id
        try:
            self.ensure_bank_exists(target_bank)
            metadata = {
                "category": category,
                "decision": decision,
                "source": "codebase_review_agent"
            }
            with self._client() as client:
                resp = client.retain(
                    bank_id=target_bank,
                    content=rule_content,
                    context=context or "Team code review feedback decision",
                    metadata=metadata
                )
                success = getattr(resp, "success", True)
                logger.info(f"Retained rule in bank '{target_bank}': {rule_content[:60]}... Success={success}")
                return success
        except Exception as e:
            logger.error(f"Error retaining rule in Hindsight: {e}")
            return False

    def list_all_memories(self, bank_id: Optional[str] = None) -> List[Dict[str, Any]]:
        target_bank = bank_id or self.default_bank_id
        try:
            self.ensure_bank_exists(target_bank)
            with self._client() as client:
                resp = client.list_memories(bank_id=target_bank, limit=50)
                items = []
                if hasattr(resp, "items") and resp.items:
                    for unit in resp.items:
                        items.append({
                            "id": getattr(unit, "id", ""),
                            "text": getattr(unit, "text", ""),
                            "fact_type": getattr(unit, "fact_type", "memory"),
                            "metadata": getattr(unit, "metadata", {}) or {},
                            "created_at": getattr(unit, "var_date", None) or getattr(unit, "updated_at", "")
                        })
                return items
        except Exception as e:
            logger.error(f"Error listing memories: {e}")
            return []

    def reset_bank(self, bank_id: Optional[str] = None) -> bool:
        """Deletes and recreates the bank for clean demo reproducibility."""
        target_bank = bank_id or self.default_bank_id
        try:
            with self._client() as client:
                try:
                    client.delete_bank(bank_id=target_bank)
                    logger.info(f"Deleted bank '{target_bank}'")
                except Exception:
                    pass
                client.create_bank(
                    bank_id=target_bank,
                    name="Codebase Memory Demo Bank",
                    mission="Store team software engineering conventions, architectural decisions, and review feedback."
                )
                logger.info(f"Re-created bank '{target_bank}'")
                return True
        except Exception as e:
            logger.error(f"Error resetting bank: {e}")
            return False

hindsight_service = HindsightService()
