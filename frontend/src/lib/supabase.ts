import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "") as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "") as string;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("http") &&
    !supabaseUrl.includes("YOUR_PROJECT") &&
    !supabaseUrl.includes("placeholder")
  );
};

/**
 * Returns the stable farm owner ID.
 *
 * Priority:
 *  1. VITE_FARM_OWNER_ID env var — set this in .env so ALL devices share the same owner_id
 *     and see the same data in Supabase. This is the CRITICAL fix for cross-device sync.
 *  2. localStorage — backward compat for devices that already have a stored ID
 *  3. Generate a new random UUID — only used when no env var is set (local-only mode)
 */
export function getFarmId(): string {
  // 1. Use env var if configured (production / cross-device sync)
  const envId = (import.meta.env.VITE_FARM_OWNER_ID || "").trim();
  if (envId && envId.length > 4 && !envId.includes("YOUR_FARM")) {
    // Also persist to localStorage so offline mode works consistently
    const stored = localStorage.getItem("azhagi_farm_id");
    if (stored !== envId) {
      localStorage.setItem("azhagi_farm_id", envId);
    }
    return envId;
  }

  // 2. Stored ID (backward compat)
  const stored = localStorage.getItem("azhagi_farm_id");
  if (stored) return stored;

  // 3. Generate new ID (local-only / first launch without env var)
  const id =
    "farm-" +
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  localStorage.setItem("azhagi_farm_id", id);
  return id;
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient("https://placeholder.supabase.co", "placeholder-key");
