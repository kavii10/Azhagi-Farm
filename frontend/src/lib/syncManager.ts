import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured, getFarmId } from "./supabase";
import { cleanOldLocalData } from "./localStore";

export type SyncState = "synced" | "syncing" | "offline" | "pending";

export interface SyncQueueItem {
  id: string;
  table: string;
  action: "upsert" | "delete";
  payload: any;
  timestamp: number;
  /** Dedup key: table + unique record identifier */
  dedupKey: string;
}

const SYNC_QUEUE_KEY = "azhagi_sync_queue";

// ─── Queue Helpers ───────────────────────────────────────────────────────────

export function getSyncQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(queue: SyncQueueItem[]): void {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new Event("azhagi_sync_changed"));
  } catch (e) {
    console.error("[SyncManager] Failed to save sync queue:", e);
  }
}

/** Build a dedup key so we never duplicate the same change */
function buildDedupKey(table: string, action: "upsert" | "delete", payload: any): string {
  const id =
    payload?.id ||
    (payload?.customer_id ? `${payload.customer_id}_${payload.entry_date}_${payload.batch}` : '') ||
    JSON.stringify(payload).slice(0, 40);
  return `${table}:${action}:${id}`;
}

/**
 * Add an item to the sync queue with deduplication.
 * If the same record already exists in the queue, the newer one replaces the old one.
 */
export function addToSyncQueue(
  table: string,
  action: "upsert" | "delete",
  payload: any
): void {
  const queue = getSyncQueue();
  const dedupKey = buildDedupKey(table, action, payload);

  // Remove any existing entry with the same dedup key
  const filtered = queue.filter((item) => item.dedupKey !== dedupKey);

  const item: SyncQueueItem = {
    id: "sync-" + Math.random().toString(36).substring(2, 9) + Date.now(),
    table,
    action,
    payload,
    timestamp: Date.now(),
    dedupKey,
  };
  filtered.push(item);
  saveSyncQueue(filtered);
  console.log(`[SyncQueue] Queued ${action} on ${table}. Queue size: ${filtered.length}`);
}

// ─── Cache Cleanup ───────────────────────────────────────────────────────────

/**
 * After successful sync to Supabase, remove stale local entries/bills to save space.
 * Retains active recent window (last 30 days of entries, 3 months of bills).
 */
export function cleanLocalCacheAfterSync(): void {
  if (!isSupabaseConfigured()) return;
  cleanOldLocalData(30);
}

// ─── Queue Drain ─────────────────────────────────────────────────────────────

let isDraining = false;

export async function drainSyncQueue(): Promise<{ success: number; failed: number }> {
  if (isDraining) return { success: 0, failed: 0 };
  if (!navigator.onLine || !isSupabaseConfigured()) {
    return { success: 0, failed: 0 };
  }

  isDraining = true;
  window.dispatchEvent(new Event("azhagi_sync_started"));
  let successCount = 0;
  let failedCount = 0;

  try {
    const queue = getSyncQueue();
    if (queue.length === 0) {
      window.dispatchEvent(new Event("azhagi_sync_completed"));
      return { success: 0, failed: 0 };
    }

    const farmId = getFarmId();
    // Only attach owner_id if it is a valid UUID
    const isValidUuid =
      typeof farmId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        farmId
      );

    const remaining: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.action === "upsert") {
          const record = { ...item.payload };
          if (isValidUuid && !record.owner_id) {
            record.owner_id = farmId;
          } else if (!isValidUuid) {
            // Drop invalid owner_id to avoid PostgreSQL UUID syntax error
            delete record.owner_id;
          }

          let onConflict: string | undefined;
          if (item.table === "milk_entries") onConflict = "customer_id,entry_date,batch";
          else if (item.table === "monthly_bills") onConflict = "customer_id,billing_year,billing_month";
          else if (item.table === "cattle_yields") onConflict = "animal_id,yield_date";
          else if (item.table === "cattle") onConflict = "id";
          else if (item.table === "customers") onConflict = "id";
          else if (item.table === "payments") onConflict = "id";
          else if (item.table === "app_settings") onConflict = "id";

          const { error } = await supabase
            .from(item.table)
            .upsert(record, onConflict ? { onConflict } : undefined);

          if (error) {
            console.warn(`[Sync] Upsert error on ${item.table}:`, error.message);
            remaining.push(item);
            failedCount++;
          } else {
            successCount++;
          }
        } else if (item.action === "delete") {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq("id", item.payload.id);

          if (error) {
            console.warn(`[Sync] Delete error on ${item.table}:`, error.message);
            remaining.push(item);
            failedCount++;
          } else {
            successCount++;
          }
        }
      } catch (err) {
        console.warn(`[Sync] Network failure while syncing ${item.table}:`, err);
        remaining.push(item);
        failedCount++;
      }
    }

    saveSyncQueue(remaining);
    console.log(`[Sync] Drain complete. Success: ${successCount}, Remaining: ${remaining.length}`);

    // Clean up stale local cache after successful drain to maintain space
    if (successCount > 0) {
      cleanLocalCacheAfterSync();
    }
  } finally {
    isDraining = false;
    window.dispatchEvent(new Event("azhagi_sync_completed"));
  }

  return { success: successCount, failed: failedCount };
}

// ─── React Hook ──────────────────────────────────────────────────────────────

export function useSyncStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(() => getSyncQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    if (navigator.onLine) {
      await drainSyncQueue();
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      drainSyncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleSyncChanged = () => {
      setQueueCount(getSyncQueue().length);
    };
    const handleSyncStarted = () => {
      setIsSyncing(true);
    };
    const handleSyncCompleted = () => {
      setIsSyncing(false);
      setQueueCount(getSyncQueue().length);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("azhagi_sync_changed", handleSyncChanged);
    window.addEventListener("azhagi_sync_started", handleSyncStarted);
    window.addEventListener("azhagi_sync_completed", handleSyncCompleted);

    // Initial drain if online
    if (navigator.onLine) {
      drainSyncQueue();
    }

    // Periodic check every 20 seconds
    const interval = setInterval(() => {
      if (navigator.onLine && getSyncQueue().length > 0) {
        drainSyncQueue();
      }
    }, 20000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("azhagi_sync_changed", handleSyncChanged);
      window.removeEventListener("azhagi_sync_started", handleSyncStarted);
      window.removeEventListener("azhagi_sync_completed", handleSyncCompleted);
      clearInterval(interval);
    };
  }, []);

  let status: SyncState = "synced";
  if (!isOnline) {
    status = "offline";
  } else if (isSyncing) {
    status = "syncing";
  } else if (queueCount > 0) {
    status = "pending";
  }

  return {
    status,
    isOnline,
    queueCount,
    isSyncing,
    syncNow,
  };
}
