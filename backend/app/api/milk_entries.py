from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Literal
import uuid
from datetime import date, datetime, timedelta
from app.core.database import get_db_connection
from app.schemas import MilkEntryUpsert, BulkNoMilkRequest, MilkEntryResponse

router = APIRouter()

@router.get("", response_model=List[MilkEntryResponse])
def get_milk_entries(
    date_val: Optional[date] = Query(None, alias="date"),
    customer_id: Optional[str] = None,
    batch: Optional[Literal["morning", "evening"]] = None,
    year: Optional[int] = None,
    month: Optional[int] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM milk_entries WHERE 1=1"
    params = []

    if date_val:
        query += " AND entry_date = ?"
        params.append(str(date_val))

    if customer_id:
        query += " AND customer_id = ?"
        params.append(customer_id)

    if batch:
        query += " AND batch = ?"
        params.append(batch)

    if year and month:
        start_date = f"{year:04d}-{month:02d}-01"
        if month == 12:
            end_date = f"{year+1:04d}-01-01"
        else:
            end_date = f"{year:04d}-{month+1:02d}-01"
        query += " AND entry_date >= ? AND entry_date < ?"
        params.extend([start_date, end_date])

    query += " ORDER BY entry_date ASC, batch ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@router.post("/upsert", response_model=MilkEntryResponse)
def upsert_milk_entry(entry: MilkEntryUpsert):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if customer exists
    cursor.execute("SELECT id FROM customers WHERE id = ?", (entry.customer_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    date_str = str(entry.entry_date)
    cursor.execute(
        "SELECT id FROM milk_entries WHERE customer_id = ? AND entry_date = ? AND batch = ?",
        (entry.customer_id, date_str, entry.batch)
    )
    existing = cursor.fetchone()
    now = datetime.utcnow().isoformat()

    if existing:
        entry_id = existing["id"]
        cursor.execute("""
            UPDATE milk_entries
            SET quantity_litre = ?, status = ?, updated_at = ?
            WHERE id = ?
        """, (entry.quantity_litre if entry.status == 'delivered' else None, entry.status, now, entry_id))
    else:
        entry_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO milk_entries (id, customer_id, entry_date, batch, quantity_litre, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (entry_id, entry.customer_id, date_str, entry.batch, entry.quantity_litre if entry.status == 'delivered' else None, entry.status, now, now))

    conn.commit()
    cursor.execute("SELECT * FROM milk_entries WHERE id = ?", (entry_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row)

@router.post("/bulk-no-milk")
def bulk_no_milk(req: BulkNoMilkRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, batch FROM customers WHERE id = ?", (req.customer_id,))
    cust = cursor.fetchone()
    if not cust:
        conn.close()
        raise HTTPException(status_code=404, detail="Customer not found")

    if req.from_date > req.to_date:
        conn.close()
        raise HTTPException(status_code=400, detail="From date must be before To date")

    # If batch is specified on request, use it. Otherwise, if customer is 'both', apply to both morning and evening.
    batches_to_apply = [req.batch] if req.batch else (["morning", "evening"] if cust["batch"] == "both" else [cust["batch"]])

    curr = req.from_date
    now = datetime.utcnow().isoformat()
    while curr <= req.to_date:
        d_str = str(curr)
        for b in batches_to_apply:
            cursor.execute(
                "SELECT id FROM milk_entries WHERE customer_id = ? AND entry_date = ? AND batch = ?",
                (req.customer_id, d_str, b)
            )
            ex = cursor.fetchone()
            if ex:
                cursor.execute("""
                    UPDATE milk_entries SET status = 'no_milk', quantity_litre = NULL, updated_at = ? WHERE id = ?
                """, (now, ex["id"]))
            else:
                nid = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO milk_entries (id, customer_id, entry_date, batch, quantity_litre, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, NULL, 'no_milk', ?, ?)
                """, (nid, req.customer_id, d_str, b, now, now))
        curr += timedelta(days=1)

    conn.commit()
    conn.close()
    return {"message": "Bulk no-milk applied successfully"}
