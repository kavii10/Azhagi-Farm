from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import uuid
from datetime import datetime
from app.core.database import get_db_connection
from app.schemas import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter()

@router.get("", response_model=List[CustomerResponse])
def get_customers(include_inactive: bool = False, batch: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM customers WHERE 1=1"
    params = []
    if not include_inactive:
        query += " AND active = 1"
    if batch:
        if batch == "morning":
            query += " AND (batch = 'morning' OR batch = 'both')"
        elif batch == "evening":
            query += " AND (batch = 'evening' OR batch = 'both')"
        else:
            query += " AND batch = ?"
            params.append(batch)
    query += " ORDER BY name ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row)

@router.post("", response_model=CustomerResponse, status_code=201)
def create_customer(customer: CustomerCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO customers (id, name, phone, address, batch, default_quantity_litre, default_quantity_evening_litre, custom_rate, notes, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        cid, customer.name, customer.phone, customer.address, customer.batch,
        customer.default_quantity_litre, customer.default_quantity_evening_litre,
        customer.custom_rate, customer.notes,
        1 if customer.active else 0, now, now
    ))
    conn.commit()
    cursor.execute("SELECT * FROM customers WHERE id = ?", (cid,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: str, updates: CustomerUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    fields = []
    values = []
    for k, v in updates.model_dump(exclude_unset=True).items():
        if k == "active":
            v = 1 if v else 0
        fields.append(f"{k} = ?")
        values.append(v)

    if fields:
        now = datetime.utcnow().isoformat()
        fields.append("updated_at = ?")
        values.append(now)
        values.append(customer_id)
        cursor.execute(f"UPDATE customers SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()

    cursor.execute("SELECT * FROM customers WHERE id = ?", (customer_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

@router.delete("/{customer_id}")
def delete_customer(customer_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM customers WHERE id = ?", (customer_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    # Cascade delete all related records
    cursor.execute("DELETE FROM payments WHERE customer_id = ?", (customer_id,))
    cursor.execute("DELETE FROM monthly_bills WHERE customer_id = ?", (customer_id,))
    cursor.execute("DELETE FROM milk_entries WHERE customer_id = ?", (customer_id,))
    cursor.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()
    conn.close()
    return {"message": "Customer and all associated records deleted successfully"}
