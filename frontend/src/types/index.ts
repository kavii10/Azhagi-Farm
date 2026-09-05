// ============================================================
// Azhagi Farm — Core TypeScript Types
// ============================================================

export type CustomerBatch = 'morning' | 'evening' | 'both';
export type Batch = 'morning' | 'evening';
export type MilkEntryStatus = 'delivered' | 'no_milk';
export type BillStatus = 'pending' | 'partial' | 'paid';

export interface AppSettings {
  id: string;
  default_rate: number;
  farm_name: string;
  currency: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  owner_id: string;
  name: string;
  phone?: string;
  address?: string;
  batch: CustomerBatch;
  default_quantity_litre: number; // Morning or single batch default
  default_quantity_evening_litre?: number; // Evening default if batch is 'both'
  custom_rate?: number;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MilkEntry {
  id: string;
  owner_id: string;
  customer_id: string;
  entry_date: string; // YYYY-MM-DD
  batch: Batch; // 'morning' | 'evening'
  quantity_litre?: number;
  status: MilkEntryStatus;
  created_at: string;
  updated_at: string;
}

export interface MonthlyBill {
  id: string;
  owner_id: string;
  customer_id: string;
  billing_year: number;
  billing_month: number;
  total_litres: number;
  rate_per_litre: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: BillStatus;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  owner_id: string;
  bill_id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at: string;
}

// ============================================================
// Derived / Enriched Types
// ============================================================

export interface CustomerWithBill extends Customer {
  bill?: MonthlyBill;
  monthlyLitres?: number;
}

export interface DailyEntryRow {
  customer: Customer;
  entry?: MilkEntry;
  entryState: 'completed' | 'no_milk' | 'not_entered';
}

// ============================================================
// Quantity constants
// ============================================================
export interface QuantityOption {
  label: string;
  value: number;
}

export const QUANTITY_OPTIONS: QuantityOption[] = [
  { label: '¼ L', value: 0.25 },
  { label: '½ L', value: 0.5 },
  { label: '¾ L', value: 0.75 },
  { label: '1 L', value: 1.0 },
  { label: '1¼ L', value: 1.25 },
  { label: '1½ L', value: 1.5 },
  { label: '1¾ L', value: 1.75 },
  { label: '2 L', value: 2.0 },
];

export function formatQuantity(litres: number): string {
  const map: Record<number, string> = {
    0.25: '¼ L',
    0.5: '½ L',
    0.75: '¾ L',
    1.0: '1 L',
    1.25: '1¼ L',
    1.5: '1½ L',
    1.75: '1¾ L',
    2.0: '2 L',
  };
  return map[litres] ?? `${litres} L`;
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getBillStatusColor(status: BillStatus): string {
  switch (status) {
    case 'paid': return 'text-green-600';
    case 'partial': return 'text-yellow-600';
    case 'pending': return 'text-red-600';
  }
}

export function getBillStatusLabel(status: BillStatus): string {
  switch (status) {
    case 'paid': return '🟢 PAID';
    case 'partial': return '🟡 PARTIAL';
    case 'pending': return '🔴 PENDING';
  }
}
