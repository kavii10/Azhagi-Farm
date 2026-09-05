import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from datetime import date
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db_connection

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("RUNNING AZHAGI FARM EXTENDED SPECIFICATION TEST SUITE")
    print("==================================================")

    # Clean database before test
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM payments")
    c.execute("DELETE FROM monthly_bills")
    c.execute("DELETE FROM milk_entries")
    c.execute("DELETE FROM customers")
    c.execute("DELETE FROM app_settings")
    c.execute("INSERT INTO app_settings (id, default_rate, farm_name, currency, created_at, updated_at) VALUES ('s1', 60.0, 'Azhagi Farm', 'INR', '2026-09-01', '2026-09-01')")
    conn.commit()
    conn.close()

    # 1. Add Kumar
    # 2. Set Kumar -> Morning
    # 3. Set default quantity -> 1 L
    # 4. Set rate -> ₹60/L (default rate or custom)
    res = client.post("/api/customers", json={
        "name": "Kumar",
        "batch": "morning",
        "default_quantity_litre": 1.0,
        "custom_rate": 60.0,
        "active": True
    })
    assert res.status_code == 201, f"Failed step 1-4: {res.text}"
    kumar = res.json()
    kumar_id = kumar["id"]
    print(f"Step 1-4 PASSED: Created customer Kumar in Morning batch with 1.0L default and ₹60/L rate.")

    # 5. Record:
    # Sep 1 -> 1 L
    # Sep 2 -> 1¼ L (1.25)
    # Sep 3 -> ¾ L (0.75)
    # Sep 4 -> No Milk
    entries_to_create = [
        ("2026-09-01", 1.0, "delivered", "morning"),
        ("2026-09-02", 1.25, "delivered", "morning"),
        ("2026-09-03", 0.75, "delivered", "morning"),
        ("2026-09-04", None, "no_milk", "morning"),
    ]
    for d, qty, st, b in entries_to_create:
        res = client.post("/api/milk-entries/upsert", json={
            "customer_id": kumar_id,
            "entry_date": d,
            "batch": b,
            "quantity_litre": qty,
            "status": st
        })
        assert res.status_code == 200, f"Failed step 5 on {d}: {res.text}"
    print(f"Step 5 PASSED: Recorded Sep 1 (1L), Sep 2 (1.25L), Sep 3 (0.75L), Sep 4 (No Milk).")

    # 6. Open Kumar history
    res = client.get(f"/api/milk-entries?customer_id={kumar_id}&year=2026&month=9")
    assert res.status_code == 200
    entries = res.json()
    assert len(entries) == 4
    print(f"Step 6 PASSED: Retrieved Kumar's milk history (4 entries).")

    # 7. Verify total = 3 L (1 + 1.25 + 0.75 + 0 = 3.0)
    delivered_entries = [e for e in entries if e["status"] == "delivered"]
    total_l = sum(e["quantity_litre"] for e in delivered_entries)
    assert total_l == 3.0, f"Expected 3.0L, got {total_l}L"
    print(f"Step 7 PASSED: Kumar's total delivered milk = {total_l} L (ignoring No Milk).")

    # 8. Verify bill = ₹180 (3 L x ₹60 = ₹180)
    res = client.get("/api/bills?year=2026&month=9")
    assert res.status_code == 200
    bills = res.json()
    kumar_bill = next((b for b in bills if b["customer_id"] == kumar_id), None)
    assert kumar_bill is not None
    assert kumar_bill["total_amount"] == 180.0, f"Expected ₹180, got {kumar_bill['total_amount']}"
    assert kumar_bill["balance_amount"] == 180.0
    print(f"Step 8 PASSED: Kumar's September bill = ₹{kumar_bill['total_amount']}.")

    # 9. Add payment = ₹100
    # 10. Verify balance = ₹80
    res = client.post("/api/payments", json={
        "bill_id": kumar_bill["id"],
        "customer_id": kumar_id,
        "amount": 100.0,
        "payment_date": "2026-09-10"
    })
    assert res.status_code == 201
    res = client.get("/api/bills?year=2026&month=9")
    kumar_bill = next(b for b in res.json() if b["customer_id"] == kumar_id)
    assert kumar_bill["paid_amount"] == 100.0
    assert kumar_bill["balance_amount"] == 80.0, f"Expected balance ₹80, got {kumar_bill['balance_amount']}"
    assert kumar_bill["status"] == "partial"
    print(f"Step 9-10 PASSED: Added payment ₹100, verified balance = ₹{kumar_bill['balance_amount']} (Status: PARTIAL).")

    # 11. Add another payment = ₹80
    # 12. Verify status = PAID
    res = client.post("/api/payments", json={
        "bill_id": kumar_bill["id"],
        "customer_id": kumar_id,
        "amount": 80.0,
        "payment_date": "2026-09-15"
    })
    assert res.status_code == 201
    res = client.get("/api/bills?year=2026&month=9")
    kumar_bill = next(b for b in res.json() if b["customer_id"] == kumar_id)
    assert kumar_bill["paid_amount"] == 180.0
    assert kumar_bill["balance_amount"] == 0.0
    assert kumar_bill["status"] == "paid"
    print(f"Step 11-12 PASSED: Added payment ₹80, verified balance = ₹0.0, status = {kumar_bill['status'].upper()}.")

    # 13. Finalize month bill and change default rate to ₹65/L
    res = client.post(f"/api/bills/finalize/{kumar_bill['id']}")
    assert res.status_code == 200
    res = client.put("/api/settings", json={"default_rate": 65.0, "farm_name": "Azhagi Farm", "currency": "INR"})
    assert res.status_code == 200
    print(f"Step 13 PASSED: Finalized bill and changed default farm rate to ₹65/L.")

    # 14. Verify the September bill remains ₹180
    res = client.get("/api/bills?year=2026&month=9")
    kumar_bill = next(b for b in res.json() if b["customer_id"] == kumar_id)
    assert kumar_bill["total_amount"] == 180.0, f"Expected September bill to remain ₹180, got {kumar_bill['total_amount']}"
    print(f"Step 14 PASSED: September bill remained intact at ₹{kumar_bill['total_amount']}.")

    # 15. Add another customer to Evening (e.g. Mani)
    res = client.post("/api/customers", json={
        "name": "Mani",
        "batch": "evening",
        "default_quantity_litre": 1.5,
        "active": True
    })
    assert res.status_code == 201
    mani_id = res.json()["id"]
    print(f"Step 15 PASSED: Added Mani to Evening Batch.")

    # 16. Verify the customer appears in Evening Batch queries
    res_m = client.get("/api/customers?batch=morning")
    res_e = client.get("/api/customers?batch=evening")
    morning_ids = [c["id"] for c in res_m.json()]
    evening_ids = [c["id"] for c in res_e.json()]
    assert kumar_id in morning_ids and kumar_id not in evening_ids
    assert mani_id in evening_ids and mani_id not in morning_ids
    print(f"Step 16 PASSED: Verified customers partitioned by batch (Kumar in Morning, Mani in Evening).")

    # 17. Verify Morning and Evening totals are correctly separated
    client.post("/api/milk-entries/upsert", json={
        "customer_id": mani_id,
        "entry_date": "2026-09-01",
        "batch": "evening",
        "quantity_litre": 1.5,
        "status": "delivered"
    })
    res = client.get("/api/dashboard/stats?date=2026-09-01")
    stats = res.json()
    assert stats["morning"]["litres"] == 1.0, f"Expected morning 1.0L, got {stats['morning']['litres']}"
    assert stats["evening"]["litres"] == 1.5, f"Expected evening 1.5L, got {stats['evening']['litres']}"
    assert stats["todayMilk"] == 2.5
    print(f"Step 17 PASSED: Morning (1.0L) and Evening (1.5L) totals cleanly separated on dashboard.")

    # 18. Verify an unentered customer shows "Not Entered", not "No Milk"
    res = client.get("/api/milk-entries?date=2026-09-02")
    date_entries = {e["customer_id"]: e for e in res.json()}
    assert kumar_id in date_entries  # Kumar was entered
    assert mani_id not in date_entries  # Mani was NOT entered on Sep 2
    print(f"Step 18 PASSED: Customer without entry on Sep 2 is recognized as unentered (absence of entry != no_milk).")

    # 19. Verify changing one day's quantity updates the monthly total correctly
    client.post("/api/milk-entries/upsert", json={
        "customer_id": mani_id,
        "entry_date": "2026-09-01",
        "batch": "evening",
        "quantity_litre": 2.0,
        "status": "delivered"
    })
    res = client.get("/api/bills?year=2026&month=9")
    mani_bill = next(b for b in res.json() if b["customer_id"] == mani_id)
    assert mani_bill["total_litres"] == 2.0, f"Expected updated 2.0L, got {mani_bill['total_litres']}"
    print(f"Step 19 PASSED: Updating daily entry dynamically updated monthly total litres to {mani_bill['total_litres']} L.")

    # 20. Verify duplicate daily records for same session cannot be created
    res = client.get(f"/api/milk-entries?customer_id={kumar_id}&date=2026-09-01")
    entries_sep1 = res.json()
    assert len(entries_sep1) == 1, f"Expected exactly 1 record for Kumar on Sep 1 morning, found {len(entries_sep1)}"
    client.post("/api/milk-entries/upsert", json={
        "customer_id": kumar_id,
        "entry_date": "2026-09-01",
        "batch": "morning",
        "quantity_litre": 1.25,
        "status": "delivered"
    })
    res = client.get(f"/api/milk-entries?customer_id={kumar_id}&date=2026-09-01")
    assert len(res.json()) == 1
    print(f"Step 20 PASSED: Unique constraint enforced - no duplicate daily records created for same session.")

    # 21. FEATURE EXPANSION TEST: Customer with 'both' batch
    res = client.post("/api/customers", json={
        "name": "Priya",
        "batch": "both",
        "default_quantity_litre": 1.0,
        "default_quantity_evening_litre": 0.5,
        "custom_rate": 60.0,
        "active": True
    })
    assert res.status_code == 201
    priya_id = res.json()["id"]

    # Verify Priya is returned in BOTH morning and evening customer lists
    res_m = client.get("/api/customers?batch=morning")
    res_e = client.get("/api/customers?batch=evening")
    assert any(c["id"] == priya_id for c in res_m.json()), "Priya should appear in Morning batch"
    assert any(c["id"] == priya_id for c in res_e.json()), "Priya should appear in Evening batch"

    # Record Priya's morning delivery (1.0 L) and evening delivery (0.5 L) on Sep 5
    client.post("/api/milk-entries/upsert", json={
        "customer_id": priya_id,
        "entry_date": "2026-09-05",
        "batch": "morning",
        "quantity_litre": 1.0,
        "status": "delivered"
    })
    client.post("/api/milk-entries/upsert", json={
        "customer_id": priya_id,
        "entry_date": "2026-09-05",
        "batch": "evening",
        "quantity_litre": 0.5,
        "status": "delivered"
    })
    res = client.get(f"/api/milk-entries?customer_id={priya_id}&date=2026-09-05")
    priya_entries = res.json()
    assert len(priya_entries) == 2, f"Expected 2 entries for Priya on Sep 5 (Morning and Evening), got {len(priya_entries)}"
    total_priya_day = sum(e["quantity_litre"] for e in priya_entries)
    assert total_priya_day == 1.5, f"Expected 1.5L total on Sep 5, got {total_priya_day}"
    print("Step 21 PASSED: 'Both' delivery batch verified — customer receives separate morning and evening entries on same day (Total: 1.5 L).")

    # 22. FEATURE EXPANSION TEST: Backfilling past day entry
    past_date = "2026-08-28"
    client.post("/api/milk-entries/upsert", json={
        "customer_id": priya_id,
        "entry_date": past_date,
        "batch": "morning",
        "quantity_litre": 1.25,
        "status": "delivered"
    })
    res = client.get(f"/api/milk-entries?customer_id={priya_id}&date={past_date}")
    assert len(res.json()) == 1 and res.json()[0]["quantity_litre"] == 1.25
    print("Step 22 PASSED: Successfully backfilled milk entry for past date.")

    # 23. FEATURE EXPANSION TEST: Delete customer
    res = client.delete(f"/api/customers/{priya_id}")
    assert res.status_code == 200
    res = client.get(f"/api/customers/{priya_id}")
    assert res.status_code == 404
    # Verify related entries deleted
    res = client.get(f"/api/milk-entries?customer_id={priya_id}")
    assert len(res.json()) == 0
    print("Step 23 PASSED: Customer deletion successfully cascade-deleted customer and all related milk entries.")

    print("\n==================================================")
    print("ALL 23 SPECIFICATION & EXPANSION TESTS PASSED! 🥛✓")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
