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

/**
 * Completely fixes and restores all customer account tallies to their true mathematical state:
 * - Recalculates total litres and total amount strictly from delivered milk entries.
 * - Recalculates paid_amount strictly from actual payments made for each bill (p.bill_id === bill.id).
 * - Restores true balance_amount = total_amount - paid_amount.
 * - Restores true status ('paid' | 'partial' | 'pending').
 * - Eliminates phantom payments and resets customer advance_balance to genuine overpayments only.
 */
export function repairAndRestoreCustomerBillTallies(): void {
  try {
    const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
    const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
    const customers = getLocalCustomers(true);
    const now = new Date().toISOString();

    // 1. Group direct payments strictly by bill_id
    const paymentsByBill = new Map<string, number>();
    for (const p of payments) {
      if (p.bill_id) {
        const cur = paymentsByBill.get(p.bill_id) || 0;
        paymentsByBill.set(p.bill_id, parseFloat((cur + (p.amount || 0)).toFixed(2)));
      }
    }

    const advanceByCustomer = new Map<string, number>();
    const billIds = new Set(bills.map((b) => b.id));

    // 2. Fix each bill strictly from milk entries and actual direct payments
    const updatedBills = bills.map((b) => {
      const entries = getLocalMilkEntriesForCustomer(b.customer_id, b.billing_year, b.billing_month);
      const delivered = entries.filter((e) => e.status === 'delivered');
      const totalLitres = parseFloat(
        delivered.reduce((sum, e) => sum + (e.quantity_litre || 0), 0).toFixed(2)
      );
      const totalAmount = parseFloat((totalLitres * b.rate_per_litre).toFixed(2));

      const directPaid = paymentsByBill.get(b.id) || 0;
      const paidAmount = directPaid;
      const balance = parseFloat(Math.max(0, totalAmount - paidAmount).toFixed(2));

      // Overpayment is real advance
      if (directPaid > totalAmount) {
        const excess = parseFloat((directPaid - totalAmount).toFixed(2));
        const curAdv = advanceByCustomer.get(b.customer_id) || 0;
        advanceByCustomer.set(b.customer_id, parseFloat((curAdv + excess).toFixed(2)));
      }

      const status: MonthlyBill['status'] =
        totalAmount === 0 && paidAmount === 0
          ? 'pending'
          : balance <= 0 && (totalAmount > 0 || paidAmount > 0)
          ? 'paid'
          : paidAmount > 0
          ? 'partial'
          : 'pending';

      return {
        ...b,
        total_litres: totalLitres,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        balance_amount: balance,
        status,
        updated_at: now,
      };
    });

    // 3. Also check for any unlinked payments to preserve them in customer's advance
    for (const p of payments) {
      if (p.customer_id && (!p.bill_id || !billIds.has(p.bill_id))) {
        const curAdv = advanceByCustomer.get(p.customer_id) || 0;
        advanceByCustomer.set(p.customer_id, parseFloat((curAdv + (p.amount || 0)).toFixed(2)));
      }
    }

    setJson(STORAGE_KEYS.BILLS, updatedBills);

    // 4. Reset customers' advance_balance to genuine amounts only
    const updatedCustomers = customers.map((c) => ({
      ...c,
      advance_balance: advanceByCustomer.get(c.id) || 0,
      updated_at: now,
    }));
    setJson(STORAGE_KEYS.CUSTOMERS, updatedCustomers);
  } catch (err) {
    console.warn('repairAndRestoreCustomerBillTallies warning:', err);
  }
}

// Auto-run to repair any prior tally discrepancy on client initialization
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('azhagi_repair_tally_v5') !== 'true') {
    repairAndRestoreCustomerBillTallies();
    localStorage.setItem('azhagi_repair_tally_v5', 'true');
  }
} catch {
  // Ignored if localstorage restricted
}

// ─── Cache Trimming & Space Maintenance ──────────────────────────────────────
/**
 * Trims old data from localStorage to keep storage footprint manageable:
 * - Retains milk entries from the last 90 days (3 months for backfilling).
 * - Retains monthly bills from the last 12 months (full year history).
 * - Retains payments associated with the retained bills.
 * - Retains ALL customers (critical for offline operations and old bill display).
 *
 * NOTE: daysToKeep param is kept for API compatibility but defaults to 90.
 */
export function cleanOldLocalData(daysToKeep = 90): { freedEntries: number; freedBills: number } {
  let freedEntries = 0;
  let freedBills = 0;

  try {
    // 1. Trim milk entries (keep last 90 days for backfilling support)
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

    // 2. Trim monthly bills (keep last 12 months — full year history for bills/pending)
    const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
    const now = new Date();
    // Keep 12 months: go back 11 months from current month
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const minYear = twelveMonthsAgo.getFullYear();
    const minMonth = twelveMonthsAgo.getMonth() + 1;

    const keptBills = bills.filter((b) => {
      if (b.billing_year > minYear) return true;
      if (b.billing_year === minYear && b.billing_month >= minMonth) return true;
      return false;
    });
    freedBills = bills.length - keptBills.length;
    if (freedBills > 0) {
      setJson(STORAGE_KEYS.BILLS, keptBills);
      const keptBillIds = new Set(keptBills.map((b) => b.id));

      // Trim payments that belong to removed bills only
      const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
      const keptPayments = payments.filter((p) => keptBillIds.has(p.bill_id));
      setJson(STORAGE_KEYS.PAYMENTS, keptPayments);
      console.log(`[LocalStorage] Cleaned ${freedBills} old monthly bills (kept last 12 months)`);
    }
  } catch (e) {
    console.warn('[LocalStorage] cleanOldLocalData error:', e);
  }

  return { freedEntries, freedBills };
}

// ---- Settings ----
export function getLocalSettings(): AppSettings {
  const current = getJson<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
  if (current) {
    if (!current.farm_name || current.farm_name === 'Azhagi Farm' || current.farm_name === 'Azhagi Farm Milk') {
      current.farm_name = 'AZHAGI NATURA';
      setJson(STORAGE_KEYS.SETTINGS, current);
    }
    return current;
  }
  const initial: AppSettings = {
    id: generateUUID(),
    default_rate: 60.0,
    farm_name: 'AZHAGI NATURA',
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
  const customers = getLocalCustomers(true); // include inactive — needed for historical bills
  const custMap = new Map(customers.map((c) => [c.id, c]));

  const filtered = bills.filter((b) => b.billing_year === year && b.billing_month === month);
  return filtered.map((b) => ({
    ...b,
    // Use real customer if available; otherwise use a placeholder so the bill is never silently dropped
    customer: custMap.get(b.customer_id) ?? {
      id: b.customer_id,
      name: 'Unknown Customer',
      phone: '',
      address: '',
      batch: 'morning' as const,
      quantity_litre: 0,
      default_quantity_litre: 0,
      active: false,
      owner_id: undefined as any,
      created_at: '',
      updated_at: '',
    },
  }));
}

export function saveLocalMonthlyBills(_year: number, _month: number, fetchedBills: MonthlyBill[]): void {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  if (!fetchedBills || fetchedBills.length === 0) return;

  const incomingById = new Map<string, MonthlyBill>();
  const incomingByCust = new Map<string, MonthlyBill>();

  for (const b of fetchedBills) {
    if (b.id) incomingById.set(b.id, b);
    incomingByCust.set(`${b.customer_id}:${b.billing_year}:${b.billing_month}`, b);
  }

  const updated: MonthlyBill[] = [];
  const handled = new Set<string>();

  for (const b of bills) {
    const custKey = `${b.customer_id}:${b.billing_year}:${b.billing_month}`;
    if (incomingById.has(b.id)) {
      const match = incomingById.get(b.id)!;
      updated.push({ ...b, ...match });
      handled.add(b.id);
    } else if (incomingByCust.has(custKey)) {
      const match = incomingByCust.get(custKey)!;
      updated.push({ ...b, ...match });
      if (match.id) handled.add(match.id);
      handled.add(b.id);
    } else {
      updated.push(b);
    }
  }

  for (const b of fetchedBills) {
    if (b.id && !handled.has(b.id)) {
      updated.push(b);
      handled.add(b.id);
    }
  }

  setJson(STORAGE_KEYS.BILLS, updated);
}

export function saveOrUpdateLocalBill(bill: MonthlyBill): void {
  saveLocalMonthlyBills(bill.billing_year, bill.billing_month, [bill]);
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

  return recalculateLocalBill(newBill.id);
}

export function recalculateLocalBill(billId: string): MonthlyBill {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const idx = bills.findIndex((b) => b.id === billId);
  if (idx === -1) {
    console.warn(`recalculateLocalBill: Bill ${billId} not found in local store`);
    return {
      id: billId,
      owner_id: undefined as any,
      customer_id: '',
      billing_year: new Date().getFullYear(),
      billing_month: new Date().getMonth() + 1,
      total_litres: 0,
      rate_per_litre: 0,
      total_amount: 0,
      paid_amount: 0,
      balance_amount: 0,
      status: 'pending',
      is_finalized: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const bill = bills[idx];

  if (bill.is_finalized) return bill;

  const entries = getLocalMilkEntriesForCustomer(bill.customer_id, bill.billing_year, bill.billing_month);
  const totalLitres = entries
    .filter((e) => e.status === 'delivered')
    .reduce((s, e) => s + (e.quantity_litre || 0), 0);
  const totalAmount = parseFloat((totalLitres * bill.rate_per_litre).toFixed(2));

  // 1. Direct payments specifically recorded for this bill
  const payments = getLocalPaymentsForBill(billId);
  const directPaid = parseFloat(
    payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)
  );

  const paidAmount = directPaid;
  const balance = parseFloat(Math.max(0, totalAmount - paidAmount).toFixed(2));
  const status: MonthlyBill['status'] =
    totalAmount === 0 && paidAmount === 0
      ? 'pending'
      : balance <= 0 && (totalAmount > 0 || paidAmount > 0)
      ? 'paid'
      : paidAmount > 0
      ? 'partial'
      : 'pending';

  const updated: MonthlyBill = {
    ...bill,
    total_litres: parseFloat(totalLitres.toFixed(2)),
    total_amount: totalAmount,
    paid_amount: paidAmount,
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
  if (idx === -1) {
    console.warn(`finalizeLocalBill: Bill ${billId} not found in local store`);
    return {
      id: billId,
      owner_id: undefined as any,
      customer_id: '',
      billing_year: new Date().getFullYear(),
      billing_month: new Date().getMonth() + 1,
      total_litres: 0,
      rate_per_litre: 0,
      total_amount: 0,
      paid_amount: 0,
      balance_amount: 0,
      status: 'pending',
      is_finalized: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
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

  // Recalculate target bill based strictly on its direct payments
  const updatedBill = recalculateLocalBill(data.bill_id);

  // Track genuine surplus advance only if total payments for this bill exceed its total amount
  const billPayments = getLocalPaymentsForBill(data.bill_id);
  const totalPaid = billPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const surplus = totalPaid > updatedBill.total_amount ? parseFloat((totalPaid - updatedBill.total_amount).toFixed(2)) : 0;
  const customers = getLocalCustomers(true);
  const cIdx = customers.findIndex((c) => c.id === data.customer_id);
  if (cIdx >= 0) {
    customers[cIdx].advance_balance = surplus;
    setJson(STORAGE_KEYS.CUSTOMERS, customers);
  }

  return newPayment;
}

export function getLocalPaymentsForBill(billId: string): Payment[] {
  const list = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
  return list.filter((p) => p.bill_id === billId).sort((a, b) => a.payment_date.localeCompare(b.payment_date));
}

export function deleteLocalPayment(paymentId: string): void {
  const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
  const target = payments.find((p) => p.id === paymentId);
  if (!target) return;

  const remaining = payments.filter((p) => p.id !== paymentId);
  setJson(STORAGE_KEYS.PAYMENTS, remaining);

  // Recalculate target bill based strictly on remaining direct payments
  recalculateLocalBill(target.bill_id);
}

export function updateLocalPayment(
  paymentId: string,
  updates: { amount?: number; payment_date?: string; notes?: string }
): void {
  const payments = getJson<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
  const idx = payments.findIndex((p) => p.id === paymentId);
  if (idx < 0) return;

  const targetBillId = payments[idx].bill_id;
  payments[idx] = { ...payments[idx], ...updates };
  setJson(STORAGE_KEYS.PAYMENTS, payments);

  // Recalculate target bill based strictly on updated direct payments
  recalculateLocalBill(targetBillId);
}

/**
 * Scans ALL local bills and computes total outstanding (unpaid) balances across every month.
 * Used offline when Supabase is not available, to show correct pending dues on Dashboard.
 */
export function getLocalAllOutstandingBalance(currentYear: number, currentMonth: number): {
  totalOutstanding: number;
  currentMonthPending: number;
  previousMonthsPending: number;
  billsByCustomer: { customerId: string; customerName: string; totalPending: number; months: { year: number; month: number; balance: number }[] }[];
} {
  const bills = getJson<MonthlyBill[]>(STORAGE_KEYS.BILLS, []);
  const customers = getLocalCustomers(true);
  const custMap = new Map(customers.map((c) => [c.id, c]));

  let totalOutstanding = 0;
  let currentMonthPending = 0;
  let previousMonthsPending = 0;
  const byCustomer = new Map<string, { name: string; total: number; months: { year: number; month: number; balance: number }[] }>();

  for (const b of bills) {
    const bal = parseFloat((b.balance_amount || 0).toFixed(2));
    if (bal <= 0) continue;
    totalOutstanding += bal;
    const isCurrent = b.billing_year === currentYear && b.billing_month === currentMonth;
    if (isCurrent) currentMonthPending += bal;
    else previousMonthsPending += bal;

    const custName = custMap.get(b.customer_id)?.name || 'Unknown Customer';
    if (!byCustomer.has(b.customer_id)) {
      byCustomer.set(b.customer_id, { name: custName, total: 0, months: [] });
    }
    const entry = byCustomer.get(b.customer_id)!;
    entry.total += bal;
    entry.months.push({ year: b.billing_year, month: b.billing_month, balance: bal });
  }

  return {
    totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
    currentMonthPending: parseFloat(currentMonthPending.toFixed(2)),
    previousMonthsPending: parseFloat(previousMonthsPending.toFixed(2)),
    billsByCustomer: Array.from(byCustomer.entries()).map(([id, v]) => ({
      customerId: id,
      customerName: v.name,
      totalPending: parseFloat(v.total.toFixed(2)),
      months: v.months.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month),
    })).sort((a, b) => b.totalPending - a.totalPending),
  };
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
