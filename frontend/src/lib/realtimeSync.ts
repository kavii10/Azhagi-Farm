/**
 * realtimeSync.ts
 *
 * Supabase Realtime cross-device sync.
 * Subscribes to Postgres changes on all key tables and fires
 * DOM custom events so every open page auto-refreshes without polling.
 *
 * Usage: call initRealtimeSync() once in App.tsx on mount.
 * Pages listen to window events:
 *   - 'azhagi_rt_customers'
 *   - 'azhagi_rt_milk_entries'
 *   - 'azhagi_rt_monthly_bills'
 *   - 'azhagi_rt_payments'
 *   - 'azhagi_rt_app_settings'
 *   - 'azhagi_rt_cattle'
 *   - 'azhagi_rt_cattle_yields'
 *   - 'azhagi_rt_any'
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { useEffect } from "react";

export type RealtimeEventName =
  | "azhagi_rt_customers"
  | "azhagi_rt_milk_entries"
  | "azhagi_rt_monthly_bills"
  | "azhagi_rt_payments"
  | "azhagi_rt_app_settings"
  | "azhagi_rt_cattle"
  | "azhagi_rt_cattle_yields"
  | "azhagi_rt_any";

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown> | null;
  oldRecord: Record<string, unknown> | null;
}

let channelRef: ReturnType<typeof supabase.channel> | null = null;
let isInitialized = false;

/**
 * Dispatch a DOM event so React components can listen and re-fetch.
 */
function fireRealtimeEvent(name: RealtimeEventName, payload: RealtimePayload) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail: payload }));
    window.dispatchEvent(
      new CustomEvent("azhagi_rt_any", {
        detail: { ...payload, eventName: name },
      })
    );
  } catch (e) {
    console.warn("[Realtime] Failed to dispatch event:", e);
  }
}

/**
 * Initialize Supabase Realtime subscriptions across all tables.
 * Safe to call multiple times — only subscribes once.
 */
export function initRealtimeSync(): void {
  if (!isSupabaseConfigured()) {
    console.log("[Realtime] Supabase not configured — offline mode");
    return;
  }
  if (isInitialized) return;
  isInitialized = true;

  try {
    // Unsubscribe existing if any
    if (channelRef) {
      supabase.removeChannel(channelRef);
      channelRef = null;
    }

    channelRef = supabase
      .channel("azhagi-farm-realtime-global")
      // 1. Customers
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
        },
        (payload) => {
          console.log("[Realtime] Customers table changed:", payload.eventType);
          fireRealtimeEvent("azhagi_rt_customers", {
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "customers",
            record: payload.new as Record<string, unknown> | null,
            oldRecord: payload.old as Record<string, unknown> | null,
          });
        }
      )
      // 2. Milk Entries
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "milk_entries",
        },
        (payload) => {
          console.log("[Realtime] Milk entries table changed:", payload.eventType);
          fireRealtimeEvent("azhagi_rt_milk_entries", {
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "milk_entries",
            record: payload.new as Record<string, unknown> | null,
            oldRecord: payload.old as Record<string, unknown> | null,
          });
        }
      )
      // 3. Monthly Bills
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monthly_bills",
        },
        (payload) => {
          console.log("[Realtime] Monthly bills table changed:", payload.eventType);
          fireRealtimeEvent("azhagi_rt_monthly_bills", {
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "monthly_bills",
            record: payload.new as Record<string, unknown> | null,
            oldRecord: payload.old as Record<string, unknown> | null,
          });
        }
      )
      // 4. Payments
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        (payload) => {
          console.log("[Realtime] Payments table changed:", payload.eventType);
          fireRealtimeEvent("azhagi_rt_payments", {
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "payments",
            record: payload.new as Record<string, unknown> | null,
            oldRecord: payload.old as Record<string, unknown> | null,
          });
        }
      )
      // 5. App Settings
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
        },
        (payload) => {
          console.log("[Realtime] App settings changed:", payload.eventType);
          fireRealtimeEvent("azhagi_rt_app_settings", {
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "app_settings",
            record: payload.new as Record<string, unknown> | null,
            oldRecord: payload.old as Record<string, unknown> | null,
          });
        }
      )
      // 6. Cattle
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cattle",
        },
        (payload) => {
          console.log("[Realtime] Cattle inventory changed:", payload.eventType);
          fireRealtimeEvent("azhagi_rt_cattle", {
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "cattle",
            record: payload.new as Record<string, unknown> | null,
            oldRecord: payload.old as Record<string, unknown> | null,
          });
        }
      )
      // 7. Cattle Yields
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cattle_yields",
        },
        (payload) => {
          console.log("[Realtime] Cattle yield changed:", payload.eventType);
          fireRealtimeEvent("azhagi_rt_cattle_yields", {
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            table: "cattle_yields",
            record: payload.new as Record<string, unknown> | null,
            oldRecord: payload.old as Record<string, unknown> | null,
          });
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] ✅ Subscribed to all farm tables. Live cross-device sync active.");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[Realtime] Channel error:", status, err);
          isInitialized = false;
        } else if (status === "CLOSED") {
          console.log("[Realtime] Channel closed.");
          isInitialized = false;
        }
      });
  } catch (e) {
    console.error("[Realtime] Failed to initialize:", e);
    isInitialized = false;
  }
}

/**
 * Cleanup realtime subscription on unmount if needed.
 */
export async function destroyRealtimeSync(): Promise<void> {
  if (channelRef) {
    await supabase.removeChannel(channelRef);
    channelRef = null;
    isInitialized = false;
  }
}

/**
 * React hook — subscribe to a specific realtime event and call handler.
 * Handler is called whenever another device makes a change.
 *
 * Usage:
 *   useRealtimeSubscription('azhagi_rt_customers', () => loadCustomers());
 */
export function useRealtimeSubscription(
  eventName: RealtimeEventName | "azhagi_rt_any",
  handler: (payload?: RealtimePayload) => void
): void {
  useEffect(() => {
    const listener = (e: Event) => {
      handler((e as CustomEvent<RealtimePayload>).detail);
    };
    window.addEventListener(eventName, listener);
    return () => window.removeEventListener(eventName, listener);
  }, [eventName, handler]);
}
