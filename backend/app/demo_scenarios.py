DEMO_SCENARIOS = [
    {
        "id": "scenario-1",
        "title": "Scenario 1: Initial PR (Baseline Review)",
        "subtitle": "Developer directly accesses DB in API layer. First time reviewing.",
        "expected_flow": "Submit code -> AI gives standard feedback -> Team clicks 'Accept Decision' -> Stored into Hindsight memory.",
        "file_name": "user_service.py",
        "language": "python",
        "code": """from fastapi import APIRouter, HTTPException
import sqlite3

router = APIRouter()

# User Registration Endpoint
@router.post("/users")
def register_user(username: str, email: str):
    # Direct database connection inside route handler
    conn = sqlite3.connect("production.db")
    cursor = conn.cursor()
    
    # Executing raw SQL directly in service logic
    cursor.execute(
        "INSERT INTO users (username, email) VALUES (?, ?)", 
        (username, email)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    
    return {"status": "created", "user_id": user_id}
"""
    },
    {
        "id": "scenario-2",
        "title": "Scenario 2: Follow-up PR (Memory Applied!)",
        "subtitle": "Different developer submits similar direct DB access in order service.",
        "expected_flow": "AI retrieves Hindsight memory -> Review explicitly flags violation of established team convention!",
        "file_name": "order_service.py",
        "language": "python",
        "code": """from fastapi import APIRouter, HTTPException
import sqlite3

router = APIRouter()

@router.post("/orders/checkout")
def checkout_cart(cart_id: str, user_id: str, amount: float):
    # Notice: Another developer accessing database directly in the controller
    db = sqlite3.connect("production.db")
    cur = db.cursor()
    
    cur.execute(
        "INSERT INTO orders (cart_id, user_id, total) VALUES (?, ?, ?)",
        (cart_id, user_id, amount)
    )
    db.commit()
    order_id = cur.lastrowid
    db.close()
    
    return {"order_id": order_id, "amount": amount, "status": "paid"}
"""
    },
    {
        "id": "scenario-3",
        "title": "Scenario 3: Error Handling & Security Convention",
        "subtitle": "PR with generic exception handling and exposed secrets.",
        "expected_flow": "Demonstrates team preference for custom domain exceptions and logging standards.",
        "file_name": "payment_gateway.py",
        "language": "python",
        "code": """import requests

def process_stripe_payment(card_token: str, amount_cents: int):
    # Hardcoded fallback key and raw try-except block
    API_SECRET = "sk_live_9384209182390123"
    
    try:
        resp = requests.post(
            "https://api.stripe.com/v1/charges",
            headers={"Authorization": f"Bearer {API_SECRET}"},
            data={"amount": amount_cents, "currency": "usd", "source": card_token}
        )
        return resp.json()
    except Exception as e:
        # Generic catch-all masking error details
        print("Payment error occurred:", e)
        return None
"""
    }
]
