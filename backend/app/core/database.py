import uuid
from datetime import date, datetime
from typing import Optional, List, Dict, Any
import sqlite3
from pathlib import Path
from app.core.config import settings

DB_FILE = Path(__file__).resolve().parent.parent.parent / "azhagi.db"

def get_db_connection():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        default_rate REAL NOT NULL DEFAULT 60.0,
        farm_name TEXT NOT NULL DEFAULT 'Azhagi Farm',
        currency TEXT NOT NULL DEFAULT 'INR',
        owner_id TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        batch TEXT NOT NULL,
        default_quantity_litre REAL NOT NULL DEFAULT 1.0,
        default_quantity_evening_litre REAL,
        custom_rate REAL,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        owner_id TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    """)

    # Try to add default_quantity_evening_litre column if table existed previously
    try:
        cursor.execute("ALTER TABLE customers ADD COLUMN default_quantity_evening_litre REAL;")
    except sqlite3.OperationalError:
        pass

    # Check if milk_entries exists with old constraint without batch
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='milk_entries'")
    tbl_row = cursor.fetchone()
    if tbl_row and "UNIQUE (customer_id, entry_date, batch)" not in tbl_row[0] and "UNIQUE(customer_id, entry_date, batch)" not in tbl_row[0]:
        # Rename old table, create new with (customer_id, entry_date, batch), copy over and drop old
        cursor.execute("ALTER TABLE milk_entries RENAME TO milk_entries_old;")
        cursor.execute("""
        CREATE TABLE milk_entries (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            batch TEXT NOT NULL DEFAULT 'morning',
            quantity_litre REAL,
            status TEXT NOT NULL DEFAULT 'delivered',
            owner_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            UNIQUE(customer_id, entry_date, batch)
        );
        """)
        cursor.execute("""
        INSERT INTO milk_entries (id, customer_id, entry_date, batch, quantity_litre, status, owner_id, created_at, updated_at)
        SELECT id, customer_id, entry_date, 'morning', quantity_litre, status, owner_id, created_at, updated_at FROM milk_entries_old;
        """)
        cursor.execute("DROP TABLE milk_entries_old;")
    else:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS milk_entries (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            batch TEXT NOT NULL DEFAULT 'morning',
            quantity_litre REAL,
            status TEXT NOT NULL DEFAULT 'delivered',
            owner_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            UNIQUE(customer_id, entry_date, batch)
        );
        """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS monthly_bills (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        billing_year INTEGER NOT NULL,
        billing_month INTEGER NOT NULL,
        total_litres REAL NOT NULL DEFAULT 0.0,
        rate_per_litre REAL NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0.0,
        paid_amount REAL NOT NULL DEFAULT 0.0,
        balance_amount REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'pending',
        is_finalized INTEGER NOT NULL DEFAULT 0,
        owner_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        UNIQUE(customer_id, billing_year, billing_month)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        notes TEXT,
        owner_id TEXT,
        created_at TEXT
    );
    """)

    # Seed default settings if empty
    cursor.execute("SELECT id FROM app_settings LIMIT 1")
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO app_settings (id, default_rate, farm_name, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), 60.0, "Azhagi Farm", "INR", datetime.utcnow().isoformat(), datetime.utcnow().isoformat())
        )

    conn.commit()
    conn.close()

# Auto initialize database on import
init_db()
