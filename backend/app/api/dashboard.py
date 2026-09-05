from fastapi import APIRouter, Query
from typing import Optional
from datetime import date
from app.core.database import get_db_connection

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(date_val: Optional[date] = Query(None, alias="date")):
    if not date_val:
        date_val = date.today()
    date_str = str(date_val)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Active customers
    cursor.execute("SELECT id, name, batch FROM customers WHERE active = 1")
    customers = [dict(r) for r in cursor.fetchall()]
    total_customers = len(customers)

    # Entries for date
    cursor.execute("SELECT * FROM milk_entries WHERE entry_date = ?", (date_str,))
    entries_list = [dict(r) for r in cursor.fetchall()]
    entry_map = {(r["customer_id"], r.get("batch", "morning")): r for r in entries_list}

    morning_custs = [c for c in customers if c["batch"] in ("morning", "both")]
    evening_custs = [c for c in customers if c["batch"] in ("evening", "both")]

    morning_completed = 0
    morning_litres = 0.0
    for c in morning_custs:
        e = entry_map.get((c["id"], "morning"))
        if e and e["status"] == "delivered":
            morning_completed += 1
            morning_litres += float(e["quantity_litre"] or 0.0)

    evening_completed = 0
    evening_litres = 0.0
    for c in evening_custs:
        e = entry_map.get((c["id"], "evening"))
        if e and e["status"] == "delivered":
            evening_completed += 1
            evening_litres += float(e["quantity_litre"] or 0.0)

    total_today_milk = round(morning_litres + evening_litres, 2)

    conn.close()
    return {
        "date": date_str,
        "totalCustomers": total_customers,
        "todayMilk": total_today_milk,
        "morning": {
            "total": len(morning_custs),
            "completed": morning_completed,
            "litres": round(morning_litres, 2)
        },
        "evening": {
            "total": len(evening_custs),
            "completed": evening_completed,
            "litres": round(evening_litres, 2)
        }
    }
