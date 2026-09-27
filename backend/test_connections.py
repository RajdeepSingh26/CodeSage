import os
import sys
from dotenv import load_dotenv

load_dotenv()

def test_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    if not api_key or "your_" in api_key:
        print("[GEMINI] Skipped or not configured")
        return False
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents="Respond with 'Gemini verified successfully' in under 5 words."
        )
        print(f"[GEMINI] SUCCESS! Model: {model} | Output: {response.text.strip()}")
        return True
    except Exception as e:
        print(f"[GEMINI] ERROR: {e}")
        return False

def test_hindsight():
    api_key = os.getenv("HINDSIGHT_API_KEY")
    base_url = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
    bank_id = os.getenv("HINDSIGHT_BANK_ID", "codebase-memory-team-default")
    if not api_key or "your_" in api_key:
        print("[HINDSIGHT] Skipped or not configured")
        return False
    try:
        from hindsight_client import Hindsight
        client = Hindsight(base_url=base_url, api_key=api_key)
        print(f"[HINDSIGHT] Connecting to {base_url} (Bank: {bank_id})...")
        
        # Ensure bank exists or create it
        try:
            client.get_bank_config(bank_id=bank_id)
            print(f"[HINDSIGHT] Bank '{bank_id}' exists.")
        except Exception:
            print(f"[HINDSIGHT] Creating bank '{bank_id}'...")
            client.create_bank(
                bank_id=bank_id,
                name="CodeSage Bank",
                mission="Store team coding conventions, architectural decisions, and review feedback."
            )
            print(f"[HINDSIGHT] Bank '{bank_id}' created successfully!")

        # Test retain
        print(f"[HINDSIGHT] Testing retain...")
        retain_resp = client.retain(
            bank_id=bank_id,
            content="Team convention: All database access must be through the Repository layer.",
            metadata={"category": "architecture", "convention": "repository_pattern"}
        )
        print(f"[HINDSIGHT] Retain OK: {retain_resp}")

        # Test recall
        print(f"[HINDSIGHT] Testing recall...")
        recall_resp = client.recall(
            bank_id=bank_id,
            query="Where should database queries be executed?"
        )
        print(f"[HINDSIGHT] Recall OK! Retrieved {len(recall_resp.results) if hasattr(recall_resp, 'results') else 'memories'}")
        if hasattr(recall_resp, 'results'):
            for idx, r in enumerate(recall_resp.results[:3]):
                print(f"  - Memory [{idx+1}]: {r.text if hasattr(r, 'text') else r}")

        client.close()
        return True
    except Exception as e:
        print(f"[HINDSIGHT] ERROR: {e}")
        return False

if __name__ == "__main__":
    print("Testing live API connections...")
    g = test_gemini()
    h = test_hindsight()
    print("--------------------------------------------------")
    print(f"Overall Result: Gemini={'PASS' if g else 'FAIL'} | Hindsight={'PASS' if h else 'FAIL'}")
