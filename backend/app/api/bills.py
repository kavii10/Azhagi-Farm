from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import uuid
from datetime import datetime
from app.core.database import get_db_connection
from app.schemas import MonthlyBillResponse

router = APIRouter()

def compute_bill_for_customer(cursor, customer_id: str, year: int, month: int, rate: float):
    # Check if bill exists
    cursor.execute("""
        SELECT * FROM monthly_bills WHERE customer_id = ? AND billing_year = ? AND billing_month = ?
    """, (customer_id, year, month))
    existing = cursor.fetchone()

    # If finalized, return existing bill unchanged
    if existing and existing["is_finalized"]:
        return dict(existing)

    # Compute delivered litres
    start_date = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end_date = f"{year+1:04d}-01-01"
    else:
        end_date = f"{year:04d}-{month+1:02d}-01"

    cursor.execute("""
        SELECT COALESCE(SUM(quantity_litre), 0.0) as total_l
        FROM milk_entries
        WHERE customer_id = ? AND status = 'delivered' AND entry_date >= ? AND entry_date < ?
    """, (customer_id, start_date, end_date))
    litres_row = cursor.fetchone()
    total_litres = round(float(litres_row["total_l"]), 2)

    bill_rate = existing["rate_per_litre"] if existing else rate
    total_amount = round(total_litres * bill_rate, 2)

    paid_amount = float(existing["paid_amount"]) if existing else 0.0
    balance = max(0.0, round(total_amount - paid_amount, 2))

    if balance <= 0:
        status = "paid"
    elif paid_amount > 0:
        status = "partial"
    else:
        status = "pending"

    now = datetime.utcnow().isoformat()
    if existing:
        bid = existing["id"]
        cursor.execute("""
            UPDATE monthly_bills
            SET total_litres = ?, total_amount = ?, balance_amount = ?, status = ?, updated_at = ?
            WHERE id = ?
        """, (total_litres, total_amount, balance, status, now, bid))
    else:
        bid = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO monthly_bills
            (id, customer_id, billing_year, billing_month, total_litres, rate_per_litre, total_amount, paid_amount, balance_amount, status, is_finalized, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        """, (bid, customer_id, year, month, total_litres, bill_rate, total_amount, 0.0, balance, status, now, now))

    cursor.execute("SELECT * FROM monthly_bills WHERE id = ?", (bid,))
    return dict(cursor.fetchone())

@router.get("", response_model=List[MonthlyBillResponse])
def get_bills(year: int = Query(...), month: int = Query(...)):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get all active customers to ensure bills exist
    cursor.execute("SELECT default_rate FROM app_settings LIMIT 1")
    s_row = cursor.fetchone()
    default_rate = float(s_row["default_rate"]) if s_row else 60.0

    cursor.execute("SELECT * FROM customers WHERE active = 1")
    active_customers = [dict(c) for c in cursor.fetchall()]

    for c in active_customers:
        applicable_rate = c["custom_rate"] if c["custom_rate"] is not None else default_rate
        compute_bill_for_customer(cursor, c["id"], year, month, applicable_rate)

    conn.commit()

    cursor.execute("""
        SELECT b.*, c.name as c_name, c.phone as c_phone, c.batch as c_batch, c.default_quantity_litre as c_default_qty, c.custom_rate as c_custom_rate
        FROM monthly_bills b
        JOIN customers c ON b.customer_id = c.id
        WHERE b.billing_year = ? AND b.billing_month = ?
        ORDER BY c.name ASC
    """, (year, month))
    rows = cursor.fetchall()

    results = []
    for r in rows:
        d = dict(r)
        d["customer"] = {
            "id": d["customer_id"],
            "name": d.pop("c_name"),
            "phone": d.pop("c_phone"),
            "batch": d.pop("c_batch"),
            "default_quantity_litre": d.pop("c_default_qty"),
            "custom_rate": d.pop("c_custom_rate"),
            "active": True
        }
        d["is_finalized"] = bool(d["is_finalized"])
        results.append(d)

    conn.close()
    return results

@router.post("/recalculate/{bill_id}", response_model=MonthlyBillResponse)
def recalculate_bill(bill_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM monthly_bills WHERE id = ?", (bill_id,))
    bill = cursor.fetchone()
    if not bill:
        conn.close()
        raise HTTPException(status_code=404, detail="Bill not found")

    cursor.execute("SELECT * FROM customers WHERE id = ?", (bill["customer_id"],))
    c = cursor.fetchone()
    cursor.execute("SELECT default_rate FROM app_settings LIMIT 1")
    s_row = cursor.fetchone()
    default_rate = float(s_row["default_rate"]) if s_row else 60.0
    rate = c["custom_rate"] if c and c["custom_rate"] is not None else default_rate

    updated = compute_bill_for_customer(cursor, bill["customer_id"], bill["billing_year"], bill["billing_month"], rate)
    conn.commit()
    conn.close()
    return updated

@router.post("/finalize/{bill_id}", response_model=MonthlyBillResponse)
def finalize_bill(bill_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM monthly_bills WHERE id = ?", (bill_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Bill not found")

    cursor.execute("UPDATE monthly_bills SET is_finalized = 1 WHERE id = ?", (bill_id,))
    conn.commit()
    cursor.execute("SELECT * FROM monthly_bills WHERE id = ?", (bill_id,))
    res = dict(cursor.fetchone())
    res["is_finalized"] = True
    conn.close()
    return res
