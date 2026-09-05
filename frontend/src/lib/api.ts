import { supabase, isSupabaseConfigured, getFarmId } from "./supabase";
import { addToSyncQueue } from "./syncManager";
import type { Customer, MilkEntry, MonthlyBill, Payment, AppSettings } from "../types";
import * as local from "./localStore";

// Helper to attach owner_id only if valid UUID
function getValidOwnerId(): string | undefined {
  const farmId = getFarmId();
  if (
    typeof farmId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      farmId
    )
  ) {
    return farmId;
  }
  return undefined;
}

// ============================================================
// Settings
// ============================================================
export async function getSettings(): Promise<AppSettings | null> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        local.saveLocalSettings(data as AppSettings);
        return data as AppSettings;
      }
    } catch (e) {
      console.warn("[Supabase] getSettings failed:", e);
    }
  }
  return local.getLocalSettings();
}

export async function upsertSettings(settings: Partial<AppSettings>) {
  const localUpdated = local.saveLocalSettings(settings);
  if (isSupabaseConfigured()) {
    const ownerId = getValidOwnerId();
    const payload: any = { ...settings };
    if (ownerId) payload.owner_id = ownerId;

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .upsert(payload)
          .select()
          .single();
        if (!error && data) {
          local.saveLocalSettings(data as AppSettings);
          return data as AppSettings;
        }
        if (error) {
          console.warn("[Supabase] upsertSettings error:", error.message);
          addToSyncQueue("app_settings", "upsert", payload);
        }
      } catch (e) {
        console.warn("[Supabase] upsertSettings failed:", e);
        addToSyncQueue("app_settings", "upsert", payload);
      }
    } else {
      addToSyncQueue("app_settings", "upsert", payload);
    }
  }
  return localUpdated;
}

// ============================================================
// Customers
// ============================================================
export async function getCustomers(includeInactive = false): Promise<Customer[]> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      let query = supabase.from("customers").select("*").order("name");
      if (!includeInactive) query = query.eq("active", true);
      const { data, error } = await query;
      if (!error && data) {
        const customers = data as Customer[];
        local.saveLocalCustomersList(customers);
        return customers;
      }
      if (error) console.warn("[Supabase] getCustomers error:", error.message);
    } catch (e) {
      console.warn("[Supabase] getCustomers failed:", e);
    }
  }
  return local.getLocalCustomers(includeInactive);
}

export async function getCustomer(id: string): Promise<Customer> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!error && data) return data as Customer;
    } catch (e) {
      console.warn("[Supabase] getCustomer failed:", e);
    }
  }
  const c = local.getLocalCustomer(id);
  if (!c) throw new Error("Customer not found");
  return c;
}

export async function createCustomer(
  customer: Omit<Customer, "id" | "owner_id" | "created_at" | "updated_at">
): Promise<Customer> {
  const newId = local.generateUUID();
  const localCust = local.createLocalCustomer({ ...customer, id: newId });

  if (isSupabaseConfigured()) {
    const ownerId = getValidOwnerId();
    const payload: any = { ...customer, id: newId };
    if (ownerId) payload.owner_id = ownerId;

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from("customers")
          .insert(payload)
          .select()
          .single();
        if (!error && data) return data as Customer;
        if (error) {
          console.warn("[Supabase] createCustomer error, queuing sync:", error.message);
          addToSyncQueue("customers", "upsert", payload);
        }
      } catch (e) {
        console.warn("[Supabase] createCustomer network issue, queuing sync:", e);
        addToSyncQueue("customers", "upsert", payload);
      }
    } else {
      addToSyncQueue("customers", "upsert", payload);
    }
  }
  return localCust;
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
  const localCust = local.updateLocalCustomer(id, updates);
  if (isSupabaseConfigured()) {
    const payload = { ...updates, id };
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from("customers")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        if (!error && data) return data as Customer;
        if (error) {
          console.warn("[Supabase] updateCustomer error, queuing sync:", error.message);
          addToSyncQueue("customers", "upsert", payload);
        }
      } catch (e) {
        console.warn("[Supabase] updateCustomer failed, queuing sync:", e);
        addToSyncQueue("customers", "upsert", payload);
      }
    } else {
      addToSyncQueue("customers", "upsert", payload);
    }
  }
  return localCust;
}

export async function deactivateCustomer(id: string): Promise<void> {
  await updateCustomer(id, { active: false });
}

export async function deleteCustomer(id: string): Promise<void> {
  local.deleteLocalCustomer(id);
  if (isSupabaseConfigured()) {
    if (navigator.onLine) {
      try {
        await supabase.from("payments").delete().eq("customer_id", id);
        await supabase.from("monthly_bills").delete().eq("customer_id", id);
        await supabase.from("milk_entries").delete().eq("customer_id", id);
        await supabase.from("customers").delete().eq("id", id);
      } catch (e) {
        console.warn("[Supabase] deleteCustomer offline, queuing sync:", e);
        addToSyncQueue("customers", "delete", { id });
      }
    } else {
      addToSyncQueue("customers", "delete", { id });
    }
  }
}

// ============================================================
// Milk Entries
// ============================================================
export async function getMilkEntriesForDate(
  date: string,
  batch?: "morning" | "evening"
): Promise<MilkEntry[]> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      let query = supabase
        .from("milk_entries")
        .select("*")
        .eq("entry_date", date);
      if (batch) query = query.eq("batch", batch);
      const { data, error } = await query;
      if (!error && data) {
        const entries = data as MilkEntry[];
        local.saveLocalMilkEntriesForDate(date, entries);
        return entries;
      }
      if (error) console.warn("[Supabase] getMilkEntriesForDate error:", error.message);
    } catch (e) {
      console.warn("[Supabase] getMilkEntriesForDate failed:", e);
    }
  }
  return local.getLocalMilkEntriesForDate(date, batch);
}

export async function getMilkEntriesForCustomer(
  customerId: string,
  year: number,
  month: number
): Promise<MilkEntry[]> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const { data, error } = await supabase
        .from("milk_entries")
        .select("*")
        .eq("customer_id", customerId)
        .gte("entry_date", start)
        .lt("entry_date", end)
        .order("entry_date");
      if (!error && data) return data as MilkEntry[];
      if (error) console.warn("[Supabase] getMilkEntriesForCustomer error:", error.message);
    } catch (e) {
      console.warn("[Supabase] getMilkEntriesForCustomer failed:", e);
    }
  }
  return local.getLocalMilkEntriesForCustomer(customerId, year, month);
}

export async function upsertMilkEntry(entry: {
  customer_id: string;
  entry_date: string;
  batch?: "morning" | "evening";
  quantity_litre?: number;
  status: "delivered" | "no_milk";
}): Promise<MilkEntry> {
  const entryBatch = entry.batch || "morning";
  const localEntry = local.upsertLocalMilkEntry({ ...entry, batch: entryBatch });

  if (isSupabaseConfigured()) {
    const ownerId = getValidOwnerId();
    const payload: any = {
      customer_id: entry.customer_id,
      entry_date: entry.entry_date,
      batch: entryBatch,
      quantity_litre: entry.status === "delivered" ? entry.quantity_litre : null,
      status: entry.status,
    };
    if (ownerId) payload.owner_id = ownerId;

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from("milk_entries")
          .upsert(payload, { onConflict: "customer_id,entry_date,batch" })
          .select()
          .single();
        if (!error && data) return data as MilkEntry;
        if (error) {
          console.warn("[Supabase] upsertMilkEntry error, queuing sync:", error.message);
          addToSyncQueue("milk_entries", "upsert", payload);
        }
      } catch (e) {
        console.warn("[Supabase] upsertMilkEntry offline, queuing sync:", e);
        addToSyncQueue("milk_entries", "upsert", payload);
      }
    } else {
      addToSyncQueue("milk_entries", "upsert", payload);
    }
  }
  return localEntry;
}

export async function bulkNoMilk(
  customerId: string,
  fromDate: string,
  toDate: string,
  batch?: "morning" | "evening"
): Promise<void> {
  local.bulkNoMilkLocal(customerId, fromDate, toDate, batch);

  if (isSupabaseConfigured()) {
    try {
      const cust = await getCustomer(customerId);
      const batchesToApply: ("morning" | "evening")[] = batch
        ? [batch]
        : cust.batch === "both"
        ? ["morning", "evening"]
        : [cust.batch === "evening" ? "evening" : "morning"];

      const entries: any[] = [];
      const [fy, fm, fd] = fromDate.split("-").map(Number);
      const [ty, tm, td] = toDate.split("-").map(Number);
      const current = new Date(fy, fm - 1, fd);
      const end = new Date(ty, tm - 1, td);
      const ownerId = getValidOwnerId();

      while (current <= end) {
        const d =
          current.getFullYear() +
          "-" +
          String(current.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(current.getDate()).padStart(2, "0");
        for (const b of batchesToApply) {
          const item: any = {
            customer_id: customerId,
            entry_date: d,
            batch: b,
            status: "no_milk",
            quantity_litre: null,
          };
          if (ownerId) item.owner_id = ownerId;
          entries.push(item);
        }
        current.setDate(current.getDate() + 1);
      }

      if (navigator.onLine) {
        const { error } = await supabase
          .from("milk_entries")
          .upsert(entries, { onConflict: "customer_id,entry_date,batch" });
        if (error) {
          console.warn("[Supabase] bulkNoMilk error, queuing sync:", error.message);
          entries.forEach((e) => addToSyncQueue("milk_entries", "upsert", e));
        }
      } else {
        entries.forEach((e) => addToSyncQueue("milk_entries", "upsert", e));
      }
    } catch (e) {
      console.warn("[Supabase] bulkNoMilk failed:", e);
    }
  }
}

// ============================================================
// Monthly Bills
// ============================================================
export async function getOrCreateMonthlyBill(
  customerId: string,
  year: number,
  month: number,
  rate: number
): Promise<MonthlyBill> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const { data: existing } = await supabase
        .from("monthly_bills")
        .select("*")
        .eq("customer_id", customerId)
        .eq("billing_year", year)
        .eq("billing_month", month)
        .maybeSingle();

      if (existing) return existing as MonthlyBill;

      const newBillId = local.generateUUID();
      const ownerId = getValidOwnerId();
      const payload: any = {
        id: newBillId,
        customer_id: customerId,
        billing_year: year,
        billing_month: month,
        rate_per_litre: rate,
        total_litres: 0,
        total_amount: 0,
        paid_amount: 0,
        balance_amount: 0,
        status: "pending",
        is_finalized: false,
      };
      if (ownerId) payload.owner_id = ownerId;

      const { data, error } = await supabase
        .from("monthly_bills")
        .insert(payload)
        .select()
        .single();
      if (!error && data) return data as MonthlyBill;
    } catch (e) {
      console.warn("[Supabase] getOrCreateMonthlyBill failed:", e);
    }
  }
  return local.getOrCreateLocalMonthlyBill(customerId, year, month, rate);
}

export async function recalculateBill(billId: string): Promise<MonthlyBill> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const { data: bill, error } = await supabase
        .from("monthly_bills")
        .select("*")
        .eq("id", billId)
        .single();
      if (!error && bill) {
        if (bill.is_finalized) return bill as MonthlyBill;

        const entries = await getMilkEntriesForCustomer(
          bill.customer_id,
          bill.billing_year,
          bill.billing_month
        );
        const delivered = entries.filter((e) => e.status === "delivered");
        const totalLitres = parseFloat(
          delivered.reduce((sum, e) => sum + (e.quantity_litre || 0), 0).toFixed(2)
        );
        const totalAmount = parseFloat((totalLitres * bill.rate_per_litre).toFixed(2));
        const balance = parseFloat(Math.max(0, totalAmount - bill.paid_amount).toFixed(2));
        const status: MonthlyBill["status"] =
          balance <= 0 ? "paid" : bill.paid_amount > 0 ? "partial" : "pending";

        const { data: updated, error: uErr } = await supabase
          .from("monthly_bills")
          .update({
            total_litres: totalLitres,
            total_amount: totalAmount,
            balance_amount: balance,
            status,
          })
          .eq("id", billId)
          .select()
          .single();

        if (!uErr && updated) return updated as MonthlyBill;
      }
    } catch (e) {
      console.warn("[Supabase] recalculateBill failed:", e);
    }
  }
  return local.recalculateLocalBill(billId);
}

export async function finalizeBill(billId: string): Promise<MonthlyBill> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      await recalculateBill(billId);
      const { data, error } = await supabase
        .from("monthly_bills")
        .update({ is_finalized: true })
        .eq("id", billId)
        .select()
        .single();
      if (!error && data) return data as MonthlyBill;
    } catch (e) {
      console.warn("[Supabase] finalizeBill failed:", e);
    }
  }
  return local.finalizeLocalBill(billId);
}

export async function getMonthlyBills(year: number, month: number) {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from("monthly_bills")
        .select("*, customer:customers(*)")
        .eq("billing_year", year)
        .eq("billing_month", month);
      if (!error && data) {
        local.saveLocalMonthlyBills(year, month, data as any);
        return data;
      }
      if (error) console.warn("[Supabase] getMonthlyBills error:", error.message);
    } catch (e) {
      console.warn("[Supabase] getMonthlyBills failed:", e);
    }
  }
  return local.getLocalMonthlyBills(year, month);
}

// ============================================================
// Payments
// ============================================================
export async function addPayment(payment: {
  bill_id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
}): Promise<Payment> {
  const newPaymentId = local.generateUUID();
  const ownerId = getValidOwnerId();
  const paymentPayload: any = {
    ...payment,
    id: newPaymentId,
  };
  if (ownerId) paymentPayload.owner_id = ownerId;

  // 1. Always record in local store for instantaneous UI update
  const localPayment = local.addLocalPayment(paymentPayload);

  // 2. Cloud sync or queue
  if (isSupabaseConfigured()) {
    if (navigator.onLine) {
      try {
        const { data: payData, error: pErr } = await supabase
          .from("payments")
          .insert(paymentPayload)
          .select()
          .single();

        if (!pErr && payData) {
          // Update bill in Supabase
          const { data: bill } = await supabase
            .from("monthly_bills")
            .select("total_amount, paid_amount")
            .eq("id", payment.bill_id)
            .single();

          if (bill) {
            const newPaid = parseFloat((bill.paid_amount + payment.amount).toFixed(2));
            const newBalance = parseFloat(Math.max(0, bill.total_amount - newPaid).toFixed(2));
            const status: MonthlyBill["status"] =
              newBalance <= 0 ? "paid" : newPaid > 0 ? "partial" : "pending";
            await supabase
              .from("monthly_bills")
              .update({ paid_amount: newPaid, balance_amount: newBalance, status })
              .eq("id", payment.bill_id);
          }
          return payData as Payment;
        } else if (pErr) {
          console.warn("[Supabase] addPayment insert error, queuing sync:", pErr.message);
          addToSyncQueue("payments", "upsert", paymentPayload);
        }
      } catch (e) {
        console.warn("[Supabase] addPayment failed, queuing sync:", e);
        addToSyncQueue("payments", "upsert", paymentPayload);
      }
    } else {
      addToSyncQueue("payments", "upsert", paymentPayload);
    }
  }

  return localPayment;
}

export async function getPaymentsForBill(billId: string): Promise<Payment[]> {
  if (isSupabaseConfigured() && navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("bill_id", billId)
        .order("payment_date");
      if (!error && data) return data as Payment[];
    } catch (e) {
      console.warn("[Supabase] getPaymentsForBill failed:", e);
    }
  }
  return local.getLocalPaymentsForBill(billId);
}

// ============================================================
// Dashboard Stats
// ============================================================
export async function getDashboardStats(date: string) {
  const customers = await getCustomers();
  const entries = await getMilkEntriesForDate(date);

  const entryMap = new Map(entries.map((e) => [`${e.customer_id}:${e.batch || "morning"}`, e]));

  const morning = customers.filter((c) => c.batch === "morning" || c.batch === "both");
  const evening = customers.filter((c) => c.batch === "evening" || c.batch === "both");

  const morningCompleted = morning.filter((c) => entryMap.has(`${c.id}:morning`)).length;
  const eveningCompleted = evening.filter((c) => entryMap.has(`${c.id}:evening`)).length;

  const morningLitres = entries
    .filter((e) => (e.batch === "morning" || !e.batch) && e.status === "delivered")
    .reduce((sum, e) => sum + (e.quantity_litre || 0), 0);

  const eveningLitres = entries
    .filter((e) => e.batch === "evening" && e.status === "delivered")
    .reduce((sum, e) => sum + (e.quantity_litre || 0), 0);

  const todayMilk = parseFloat((morningLitres + eveningLitres).toFixed(2));

  return {
    totalCustomers: customers.length,
    todayMilk,
    morning: {
      completed: morningCompleted,
      total: morning.length,
      litres: parseFloat(morningLitres.toFixed(2)),
    },
    evening: {
      completed: eveningCompleted,
      total: evening.length,
      litres: parseFloat(eveningLitres.toFixed(2)),
    },
  };
}

// ============================================================
// Analytics Data
// ============================================================
export interface MonthlyAnalytics {
  month: number;
  year: number;
  label: string;
  totalLitres: number;
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  customerCount: number;
}

export async function getAnalyticsData(year: number): Promise<{
  monthly: MonthlyAnalytics[];
  ytdRevenue: number;
  ytdLitres: number;
  collectionRate: number;
  totalOutstanding: number;
  topCustomers: { name: string; litres: number; amount: number }[];
}> {
  const monthly: MonthlyAnalytics[] = [];
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const now = new Date();

  for (let m = 1; m <= 12; m++) {
    if (year === now.getFullYear() && m > now.getMonth() + 1) {
      monthly.push({
        month: m, year, label: `${monthNames[m - 1]}`,
        totalLitres: 0, totalBilled: 0, totalCollected: 0, totalPending: 0, customerCount: 0,
      });
      continue;
    }
    const bills = await getMonthlyBills(year, m);
    const totalLitres = parseFloat(bills.reduce((s: number, b: any) => s + (b.total_litres || 0), 0).toFixed(2));
    const totalBilled = parseFloat(bills.reduce((s: number, b: any) => s + (b.total_amount || 0), 0).toFixed(2));
    const totalCollected = parseFloat(bills.reduce((s: number, b: any) => s + (b.paid_amount || 0), 0).toFixed(2));
    const totalPending = parseFloat(Math.max(0, totalBilled - totalCollected).toFixed(2));
    const customerCount = bills.filter((b: any) => (b.total_litres || 0) > 0).length;

    monthly.push({
      month: m, year,
      label: monthNames[m - 1],
      totalLitres, totalBilled, totalCollected, totalPending, customerCount,
    });
  }

  const ytdRevenue = parseFloat(monthly.reduce((s, m) => s + m.totalCollected, 0).toFixed(2));
  const ytdLitres = parseFloat(monthly.reduce((s, m) => s + m.totalLitres, 0).toFixed(2));
  const ytdBilled = parseFloat(monthly.reduce((s, m) => s + m.totalBilled, 0).toFixed(2));
  const totalOutstanding = parseFloat(monthly.reduce((s, m) => s + m.totalPending, 0).toFixed(2));
  const collectionRate = ytdBilled > 0 ? parseFloat(((ytdRevenue / ytdBilled) * 100).toFixed(1)) : 0;

  const latestMonth = now.getMonth() + 1;
  const latestYear = now.getFullYear();
  const latestBills = await getMonthlyBills(latestYear, latestMonth);
  const customers = await getCustomers();
  const custMap = new Map(customers.map((c) => [c.id, c]));

  const topCustomers = latestBills
    .map((b: any) => ({
      name: custMap.get(b.customer_id)?.name || b.customer?.name || "Unknown",
      litres: b.total_litres || 0,
      amount: b.total_amount || 0,
    }))
    .filter((c) => c.litres > 0)
    .sort((a, b) => b.litres - a.litres)
    .slice(0, 8);

  return { monthly, ytdRevenue, ytdLitres, collectionRate, totalOutstanding, topCustomers };
}
