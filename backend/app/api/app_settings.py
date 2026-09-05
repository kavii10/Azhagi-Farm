from fastapi import APIRouter
from datetime import datetime
from app.core.database import get_db_connection
from app.schemas import AppSettingsSchema

router = APIRouter()

@router.get("", response_model=AppSettingsSchema)
def get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM app_settings LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return AppSettingsSchema()

@router.put("", response_model=AppSettingsSchema)
def update_settings(settings_in: AppSettingsSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM app_settings LIMIT 1")
    row = cursor.fetchone()
    now = datetime.utcnow().isoformat()

    if row:
        sid = row["id"]
        cursor.execute("""
            UPDATE app_settings
            SET default_rate = ?, farm_name = ?, currency = ?, updated_at = ?
            WHERE id = ?
        """, (settings_in.default_rate, settings_in.farm_name, settings_in.currency, now, sid))
    else:
        import uuid
        sid = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO app_settings (id, default_rate, farm_name, currency, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (sid, settings_in.default_rate, settings_in.farm_name, settings_in.currency, now, now))

    conn.commit()
    cursor.execute("SELECT * FROM app_settings WHERE id = ?", (sid,))
    updated = cursor.fetchone()
    conn.close()
    return dict(updated)
