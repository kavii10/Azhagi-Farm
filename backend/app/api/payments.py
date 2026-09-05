from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import uuid
from datetime import datetime
from app.core.database import get_db_connection
from app.schemas import PaymentCreate, PaymentResponse

router = APIRouter()

@router.get("", response_model=List[PaymentResponse])
def get_payments(bill_id: Optional[str] = None, customer_id: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM payments WHERE 1=1"
    params = []
    if bill_id:
        query += " AND bill_id = ?"
        params.append(bill_id)
    if customer_id:
        query += " AND customer_id = ?"
        params.append(customer_id)
    query += " ORDER BY payment_date DESC, created_at DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("", response_model=PaymentResponse, status_code=201)
def add_payment(payment: PaymentCreate):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM monthly_bills WHERE id = ?", (payment.bill_id,))
    bill = cursor.fetchone()
    if not bill:
        conn.close()
        raise HTTPException(status_code=404, detail="Bill not found")

    pid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO payments (id, bill_id, customer_id, amount, payment_date, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (pid, payment.bill_id, payment.customer_id, payment.amount, str(payment.payment_date), payment.notes, now))

    # Update bill amounts and status
    new_paid = round(float(bill["paid_amount"]) + payment.amount, 2)
    new_balance = max(0.0, round(float(bill["total_amount"]) - new_paid, 2))
    if new_balance <= 0:
        new_status = "paid"
    elif new_paid > 0:
        new_status = "partial"
    else:
        new_status = "pending"

    cursor.execute("""
        UPDATE monthly_bills
        SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = ?
        WHERE id = ?
    """, (new_paid, new_balance, new_status, now, payment.bill_id))

    conn.commit()
    cursor.execute("SELECT * FROM payments WHERE id = ?", (pid,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)
