import type { AppSettings, Customer, MilkEntry, MonthlyBill, Payment } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'azhagi_settings',
  CUSTOMERS: 'azhagi_customers',
  ENTRIES: 'azhagi_milk_entries',
  BILLS: 'azhagi_monthly_bills',
  PAYMENTS: 'azhagi_payments',
  AUTH_USER: 'azhagi_auth_user',
};

// Standard RFC4122 v4 UUID generator (accepted by PostgreSQL UUID column)
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function setJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

// ─── Legacy ID Migration (Fixes old cust-, bill-, entry- prefixes to valid UUIDs) ───
export function migrateLegacyIds(): void {
  try {
    const idMap = new Map<string, string>();

    // 1. Migrate customers
    const customers = getJson<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
    let custChanged = false;
    const migratedCustomers = customers.map((c) => {
      if (c.id && !c.id.includes('-') || c.id.startsWith('cust-')) {
        const newId = generateUUID();
        idMap.set(c.id, newId);
        custChanged = true;
        return { ...c, id: newId };
      }
      return c;
    });
    if (custChanged) setJson(STORAGE_KEYS.CUSTOMERS, migratedCustomers);

    // 2. Migrate entries
    const entries = getJson<MilkEntry[]>(STORAGE_KEYS.ENTRIES, []);
    let entChanged = false;
    const migratedEntries = entries.map((e) => {
      let changed = false;
      let newId = e.id;
      let newCustId = e.customer_id;
      if (e.id && e.id.startsWith('entry-')) {
        newId = generateUUID();
        changed = true;
      }
      if (idMap.has(e.customer_id)) {
        newCustId = idMap.get(e.customer_id)!;
        changed = true;
      }
      if (changed) {
        entChanged = true;
        return { ...e, id: newId, customer_id: newCustId };
      }
      return e;
    });
    if (entChanged) setJson(STORAGE_KEYS.ENTRIES, migratedEntries);

    // 3. Migrate bills
    const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
    let billsChanged = false;
    const billIdMap = new Map<string, string>();
    const migratedBills = bills.map((b) => {
      let changed = false;
      let newId = b.id;
      let newCustId = b.customer_id;
      if (b.id && b.id.startsWith('bill-')) {
        newId = generateUUID();
        billIdMap.set(b.id, newId);
        changed = true;
      }
      if (idMap.has(b.customer_id)) {
        newCustId = idMap.get(b.customer_id)!;
        changed = true;
      }
      if (changed) {
        billsChanged = true;
        return { ...b, id: newId, customer_id: newCustId };
      }
      return b;
    });
    if (billsChanged) setJson(STORAGE_KEYS.BILLS, migratedBills);

    // 4. Migrate payments
    const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
    let pmtChanged = false;
    const migratedPayments = payments.map((p) => {
      let changed = false;
      let newId = p.id;
      let newBillId = p.bill_id;
      let newCustId = p.customer_id;
      if (p.id && p.id.startsWith('pmt-')) {
        newId = generateUUID();
        changed = true;
      }
      if (billIdMap.has(p.bill_id)) {
        newBillId = billIdMap.get(p.bill_id)!;
        changed = true;
      }
      if (idMap.has(p.customer_id)) {
        newCustId = idMap.get(p.customer_id)!;
        changed = true;
      }
      if (changed) {
        pmtChanged = true;
        return { ...p, id: newId, bill_id: newBillId, customer_id: newCustId };
      }
      return p;
    });
    if (pmtChanged) setJson(STORAGE_KEYS.PAYMENTS, migratedPayments);
  } catch (e) {
    console.warn('Legacy ID migration check:', e);
  }
}

// Run ID migration once on module initialization
migrateLegacyIds();

// ─── Cache Trimming & Space Maintenance ──────────────────────────────────────
/**
 * Trims old data from localStorage to keep storage footprint minimal:
 * - Retains milk entries from the last 30 days only.
 * - Retains monthly bills from the last 3 months only.
 * - Retains payments associated with the retained bills.
 * - Retains ALL customers (critical for offline daily entry operations).
 */
export function cleanOldLocalData(daysToKeep = 30): { freedEntries: number; freedBills: number } {
  let freedEntries = 0;
  let freedBills = 0;

  try {
    // 1. Trim milk entries
    const entries = getJson<MilkEntry[]>(STORAGE_KEYS.ENTRIES, []);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const keptEntries = entries.filter((e) => e.entry_date >= cutoffStr);
    freedEntries = entries.length - keptEntries.length;
    if (freedEntries > 0) {
      setJson(STORAGE_KEYS.ENTRIES, keptEntries);
      console.log(`[LocalStorage] Cleaned ${freedEntries} old milk entries (kept last ${daysToKeep} days)`);
    }

    // 2. Trim monthly bills (keep last 3 months)
    const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const minYear = threeMonthsAgo.getFullYear();
    const minMonth = threeMonthsAgo.getMonth() + 1;

    const keptBills = bills.filter((b) => {
      if (b.billing_year > minYear) return true;
      if (b.billing_year === minYear && b.billing_month >= minMonth) return true;
      return false;
    });
    freedBills = bills.length - keptBills.length;
    if (freedBills > 0) {
      setJson(STORAGE_KEYS.BILLS, keptBills);
      const keptBillIds = new Set(keptBills.map((b) => b.id));

      // Trim associated payments
      const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
      const keptPayments = payments.filter((p) => keptBillIds.has(p.bill_id));
      setJson(STORAGE_KEYS.PAYMENTS, keptPayments);
      console.log(`[LocalStorage] Cleaned ${freedBills} old monthly bills`);
    }
  } catch (e) {
    console.warn('[LocalStorage] cleanOldLocalData error:', e);
  }

  return { freedEntries, freedBills };
}

// ---- Settings ----
export function getLocalSettings(): AppSettings {
  const current = getJson<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
  if (current) return current;
  const initial: AppSettings = {
    id: generateUUID(),
    default_rate: 60.0,
    farm_name: 'Azhagi Farm',
    currency: 'INR',
    owner_id: undefined as any,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  setJson(STORAGE_KEYS.SETTINGS, initial);
  return initial;
}

export function saveLocalSettings(updates: Partial<AppSettings>): AppSettings {
  const current = getLocalSettings();
  const updated: AppSettings = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setJson(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

// ---- Customers ----
export function getLocalCustomers(includeInactive = false): Customer[] {
  const list = getJson<Customer[]>(STORAGE_KEYS.CUSTOMERS, []);
  if (!includeInactive) {
    return list.filter((c) => c.active !== false).sort((a, b) => a.name.localeCompare(b.name));
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveLocalCustomersList(customers: Customer[]): void {
  setJson(STORAGE_KEYS.CUSTOMERS, customers);
}

export function getLocalCustomer(id: string): Customer | undefined {
  const list = getLocalCustomers(true);
  return list.find((c) => c.id === id);
}

export function createLocalCustomer(
  data: Omit<Customer, 'id' | 'owner_id' | 'created_at' | 'updated_at'> & { id?: string }
): Customer {
  const list = getLocalCustomers(true);
  const now = new Date().toISOString();
  const newCust: Customer = {
    ...data,
    id: data.id || generateUUID(),
    owner_id: undefined as any,
    created_at: now,
    updated_at: now,
    active: true,
  };
  list.push(newCust);
  setJson(STORAGE_KEYS.CUSTOMERS, list);
  return newCust;
}

export function updateLocalCustomer(id: string, updates: Partial<Customer>): Customer {
  const list = getLocalCustomers(true);
  const index = list.findIndex((c) => c.id === id);
  if (index === -1) throw new Error('Customer not found');
  const now = new Date().toISOString();
  list[index] = { ...list[index], ...updates, updated_at: now };
  setJson(STORAGE_KEYS.CUSTOMERS, list);
  return list[index];
}

export function deactivateLocalCustomer(id: string): void {
  updateLocalCustomer(id, { active: false });
}

export function deleteLocalCustomer(id: string): void {
  // Remove customer
  const list = getLocalCustomers(true).filter((c) => c.id !== id);
  setJson(STORAGE_KEYS.CUSTOMERS, list);

  // Cascade delete entries
  const entries = getJson<MilkEntry[]>(STORAGE_KEYS.ENTRIES, []).filter((e) => e.customer_id !== id);
  setJson(STORAGE_KEYS.ENTRIES, entries);

  // Cascade delete bills
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []).filter((b) => b.customer_id !== id);
  setJson(STORAGE_KEYS.BILLS, bills);

  // Cascade delete payments
  const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []).filter((p) => p.customer_id !== id);
  setJson(STORAGE_KEYS.PAYMENTS, payments);
}

// ---- Milk Entries ----
export function getLocalMilkEntriesForDate(date: string, batch?: 'morning' | 'evening'): MilkEntry[] {
  const list = getJson<MilkEntry[]>(STORAGE_KEYS.ENTRIES, []);
  return list.filter((e) => {
    const matchDate = e.entry_date === date;
    const matchBatch = !batch || (e.batch || 'morning') === batch;
    return matchDate && matchBatch;
  });
}

export function saveLocalMilkEntriesForDate(date: string, fetchedEntries: MilkEntry[]): void {
  const list = getJson<MilkEntry[]>(STORAGE_KEYS.ENTRIES, []);
  // Remove entries for that date
  const filtered = list.filter((e) => e.entry_date !== date);
  // Add fetched entries
  filtered.push(...fetchedEntries);
  setJson(STORAGE_KEYS.ENTRIES, filtered);
}

export function getLocalMilkEntriesForCustomer(
  customerId: string,
  year: number,
  month: number
): MilkEntry[] {
  const list = getJson<MilkEntry[]>(STORAGE_KEYS.ENTRIES, []);
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return list
    .filter((e) => e.customer_id === customerId && e.entry_date.startsWith(prefix))
    .sort((a, b) => {
      const cmp = a.entry_date.localeCompare(b.entry_date);
      if (cmp !== 0) return cmp;
      return (a.batch || 'morning').localeCompare(b.batch || 'morning');
    });
}

export function upsertLocalMilkEntry(entry: {
  id?: string;
  customer_id: string;
  entry_date: string;
  batch?: 'morning' | 'evening';
  quantity_litre?: number;
  status: 'delivered' | 'no_milk';
}): MilkEntry {
  const list = getJson<MilkEntry[]>(STORAGE_KEYS.ENTRIES, []);
  const entryBatch = entry.batch || 'morning';
  const idx = list.findIndex(
    (e) =>
      e.customer_id === entry.customer_id &&
      e.entry_date === entry.entry_date &&
      (e.batch || 'morning') === entryBatch
  );
  const now = new Date().toISOString();

  let result: MilkEntry;
  if (idx >= 0) {
    result = {
      ...list[idx],
      id: entry.id || list[idx].id || generateUUID(),
      batch: entryBatch,
      quantity_litre: entry.status === 'delivered' ? entry.quantity_litre : undefined,
      status: entry.status,
      updated_at: now,
    };
    list[idx] = result;
  } else {
    result = {
      id: entry.id || generateUUID(),
      owner_id: undefined as any,
      customer_id: entry.customer_id,
      entry_date: entry.entry_date,
      batch: entryBatch,
      quantity_litre: entry.status === 'delivered' ? entry.quantity_litre : undefined,
      status: entry.status,
      created_at: now,
      updated_at: now,
    };
    list.push(result);
  }
  setJson(STORAGE_KEYS.ENTRIES, list);
  return result;
}

export function bulkNoMilkLocal(
  customerId: string,
  fromDate: string,
  toDate: string,
  batch?: 'morning' | 'evening'
): void {
  const cust = getLocalCustomer(customerId);
  const batchesToApply: ('morning' | 'evening')[] = batch
    ? [batch]
    : cust?.batch === 'both'
    ? ['morning', 'evening']
    : [cust?.batch === 'evening' ? 'evening' : 'morning'];

  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  const current = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (current <= end) {
    const dStr =
      current.getFullYear() +
      '-' +
      String(current.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(current.getDate()).padStart(2, '0');
    for (const b of batchesToApply) {
      upsertLocalMilkEntry({
        customer_id: customerId,
        entry_date: dStr,
        batch: b,
        status: 'no_milk',
      });
    }
    current.setDate(current.getDate() + 1);
  }
}

// ---- Monthly Bills ----
export function getLocalMonthlyBills(year: number, month: number): (MonthlyBill & { customer: Customer })[] {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const customers = getLocalCustomers(true);
  const custMap = new Map(customers.map((c) => [c.id, c]));

  const filtered = bills.filter((b) => b.billing_year === year && b.billing_month === month);
  return filtered
    .map((b) => ({
      ...b,
      customer: custMap.get(b.customer_id)!,
    }))
    .filter((b) => Boolean(b.customer));
}

export function saveLocalMonthlyBills(year: number, month: number, fetchedBills: MonthlyBill[]): void {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const other = bills.filter((b) => !(b.billing_year === year && b.billing_month === month));
  other.push(...fetchedBills);
  setJson(STORAGE_KEYS.BILLS, other);
}

export function getOrCreateLocalMonthlyBill(
  customerId: string,
  year: number,
  month: number,
  rate: number,
  initialId?: string
): MonthlyBill {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const existing = bills.find(
    (b) => b.customer_id === customerId && b.billing_year === year && b.billing_month === month
  );
  if (existing) return existing;

  const entries = getLocalMilkEntriesForCustomer(customerId, year, month);
  const totalLitres = entries
    .filter((e) => e.status === 'delivered')
    .reduce((s, e) => s + (e.quantity_litre || 0), 0);
  const totalAmount = parseFloat((totalLitres * rate).toFixed(2));

  const now = new Date().toISOString();
  const newBill: MonthlyBill = {
    id: initialId || generateUUID(),
    owner_id: undefined as any,
    customer_id: customerId,
    billing_year: year,
    billing_month: month,
    total_litres: parseFloat(totalLitres.toFixed(2)),
    rate_per_litre: rate,
    total_amount: totalAmount,
    paid_amount: 0,
    balance_amount: totalAmount,
    status: 'pending',
    is_finalized: false,
    created_at: now,
    updated_at: now,
  };
  bills.push(newBill);
  setJson(STORAGE_KEYS.BILLS, bills);
  return newBill;
}

export function recalculateLocalBill(billId: string): MonthlyBill {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const idx = bills.findIndex((b) => b.id === billId);
  if (idx === -1) throw new Error('Bill not found');
  const bill = bills[idx];

  if (bill.is_finalized) return bill;

  const entries = getLocalMilkEntriesForCustomer(bill.customer_id, bill.billing_year, bill.billing_month);
  const totalLitres = entries
    .filter((e) => e.status === 'delivered')
    .reduce((s, e) => s + (e.quantity_litre || 0), 0);
  const totalAmount = parseFloat((totalLitres * bill.rate_per_litre).toFixed(2));
  const balance = parseFloat(Math.max(0, totalAmount - bill.paid_amount).toFixed(2));
  const status = balance <= 0 ? 'paid' : bill.paid_amount > 0 ? 'partial' : 'pending';

  const updated: MonthlyBill = {
    ...bill,
    total_litres: parseFloat(totalLitres.toFixed(2)),
    total_amount: totalAmount,
    balance_amount: balance,
    status,
    updated_at: new Date().toISOString(),
  };
  bills[idx] = updated;
  setJson(STORAGE_KEYS.BILLS, bills);
  return updated;
}

export function finalizeLocalBill(billId: string): MonthlyBill {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const idx = bills.findIndex((b) => b.id === billId);
  if (idx === -1) throw new Error('Bill not found');
  bills[idx].is_finalized = true;
  bills[idx].updated_at = new Date().toISOString();
  setJson(STORAGE_KEYS.BILLS, bills);
  return bills[idx];
}

// ---- Payments ----
export function addLocalPayment(data: {
  id?: string;
  bill_id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
}): Payment {
  const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
  const now = new Date().toISOString();
  const newPayment: Payment = {
    id: data.id || generateUUID(),
    owner_id: undefined as any,
    bill_id: data.bill_id,
    customer_id: data.customer_id,
    amount: data.amount,
    payment_date: data.payment_date,
    notes: data.notes,
    created_at: now,
  };
  payments.push(newPayment);
  setJson(STORAGE_KEYS.PAYMENTS, payments);

  // Update bill paid and balance
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const bIdx = bills.findIndex((b) => b.id === data.bill_id);
  if (bIdx >= 0) {
    const bill = bills[bIdx];
    const newPaid = parseFloat((bill.paid_amount + data.amount).toFixed(2));
    const newBalance = parseFloat(Math.max(0, bill.total_amount - newPaid).toFixed(2));
    const status = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    bills[bIdx] = {
      ...bill,
      paid_amount: newPaid,
      balance_amount: newBalance,
      status,
      updated_at: now,
    };
    setJson(STORAGE_KEYS.BILLS, bills);
  }

  return newPayment;
}

export function getLocalPaymentsForBill(billId: string): Payment[] {
  const list = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
  return list.filter((p) => p.bill_id === billId).sort((a, b) => a.payment_date.localeCompare(b.payment_date));
}

// ---- Local Auth Helper ----
export function getLocalAuthUser(): { id: string; email: string } | null {
  return getJson<{ id: string; email: string } | null>(STORAGE_KEYS.AUTH_USER, {
    id: 'owner-local-admin',
    email: 'admin@azhagifarm.com',
  });
}

export function setLocalAuthUser(user: { id: string; email: string } | null): void {
  setJson(STORAGE_KEYS.AUTH_USER, user);
}
