import sys
from pathlib import Path
import pytest

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "Engram"

def test_get_scenarios():
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    scenarios = response.json()
    assert len(scenarios) >= 2
    assert scenarios[0]["id"] == "scenario-1"

def test_review_endpoint_bypass_memory():
    # Test baseline review without memory
    payload = {
        "code": "def calculate_total(a, b):\n    return a + b\n",
        "file_name": "math_util.py",
        "language": "python",
        "bypass_memory": True
    }
    response = client.post("/api/review", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert "summary" in res_data
    assert "findings" in res_data
    assert isinstance(res_data["findings"], list)

def test_hindsight_decision_and_memory_review():
    # 1. Record an accepted team convention decision
    decision_payload = {
        "finding_title": "Enforce Repository Layer for SQL",
        "finding_category": "architecture",
        "finding_description": "All database queries must go through the Repository pattern.",
        "decision": "accept",
        "feedback_rule": "Team Convention [architecture]: All SQL queries must be placed in repository classes, never in API route handlers."
    }
    dec_res = client.post("/api/decision", json=decision_payload)
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert dec_data["success"] is True

    # Allow Hindsight Cloud indexing to process
    import time
    time.sleep(2.5)

    # 2. Check that memory shows up in list
    list_res = client.get("/api/memory/list")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["count"] > 0

    # 3. Review code that violates this convention with memory enabled
    code_violating = """
from fastapi import APIRouter
import sqlite3

router = APIRouter()

@router.get("/items")
def get_items():
    db = sqlite3.connect("app.db")
    return db.execute("SELECT * FROM items").fetchall()
"""
    review_res = client.post("/api/review", json={
        "code": code_violating,
        "file_name": "items_router.py",
        "language": "python",
        "bypass_memory": False
    })
    assert review_res.status_code == 200
    review_data = review_res.json()
    assert len(review_data["findings"]) > 0
    # Ensure memory was recalled and review mode is memory_informed
    assert len(review_data["memories_retrieved"]) > 0
    assert review_data["review_mode"] == "memory_informed"

def test_agent_pipeline_diff_and_timeline():
    code = "def get_active_users():\n    return [u for u in users if u.is_active]\n"
    res = client.post("/api/review", json={
        "code": code,
        "file_name": "users.py",
        "language": "python",
        "bypass_memory": True
    })
    assert res.status_code == 200
    data = res.json()
    assert "timeline" in data
    assert len(data["timeline"]) >= 4
    # Check that key pipeline nodes executed
    nodes = [step["node_name"] for step in data["timeline"]]
    assert "recall_node" in nodes
    assert "analysis_node" in nodes
    assert "fix_node" in nodes
    assert "validation_node" in nodes
    assert "final_review_node" in nodes
    
    # Check proposed fix structure
    assert data["proposed_fix"] is not None
    assert "fixed_code" in data["proposed_fix"]
    assert "diff" in data["proposed_fix"]
    assert "validation_status" in data["proposed_fix"]

