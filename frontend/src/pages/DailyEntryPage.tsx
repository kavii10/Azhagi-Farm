import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Plus,
  Minus,
} from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/appStore';
import { getMilkEntriesForDate, upsertMilkEntry, bulkNoMilk } from '../lib/api';
import type { Customer, MilkEntry, Batch } from '../types';
import { QUANTITY_OPTIONS as QTY_OPTIONS, formatQuantity } from '../types';
import QuickBulkEntryModal from '../components/QuickBulkEntryModal';
import { useRealtimeSubscription } from '../lib/realtimeSync';

type Filter = 'all' | 'completed' | 'no_milk' | 'not_entered';

// ---- Quantity Picker ----
function QuantityPicker({
  customer,
  batch,
  entry,
  onSave,
  onClose,
}: {
  customer: Customer;
  batch: Batch;
  entry?: MilkEntry;
  onSave: (qty: number | null, status: 'delivered' | 'no_milk') => Promise<void>;
  onClose: () => void;
}) {
  const [customQty, setCustomQty] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  const defaultQty =
    batch === 'evening' && customer.batch === 'both'
      ? customer.default_quantity_evening_litre || 0.5
      : customer.default_quantity_litre;

  const handleSelect = async (qty: number) => {
    setSaving(true);
    try {
      await onSave(qty, 'delivered');
      toast.success(`✓ ${customer.name} (${batch === 'morning' ? 'Morning' : 'Evening'}) — ${formatQuantity(qty)} saved`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleNoMilk = async () => {
    setSaving(true);
    try {
      await onSave(null, 'no_milk');
      toast.success(`🚫 ${customer.name} (${batch === 'morning' ? 'Morning' : 'Evening'}) — No Milk recorded`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleCustomSave = async () => {
    const val = parseFloat(customQty);
    if (isNaN(val) || val <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    setSaving(true);
    try {
      await onSave(val, 'delivered');
      toast.success(`✓ ${customer.name} — ${val} L saved`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-lg">{customer.name}</span>
              <span
                className={clsx(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  batch === 'morning' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                )}
              >
                {batch === 'morning' ? '🌅 Morning' : '🌙 Evening'}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              Default: {formatQuantity(defaultQty)}
              {entry && (
                <span className="ml-2 text-blue-500 font-medium">
                  (Current: {entry.status === 'no_milk' ? '🚫 No Milk' : formatQuantity(entry.quantity_litre || 0)})
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Quantity Grid */}
        <div className="px-4 py-4">
          <p className="text-sm text-gray-500 mb-3 font-medium">
            Select quantity for this {batch} session
          </p>
          <div className="grid grid-cols-4 gap-2">
            {QTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                disabled={saving}
                className={clsx(
                  'py-3 rounded-xl text-sm font-bold transition-all border-2',
                  entry?.status === 'delivered' && entry.quantity_litre === opt.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-green-400 hover:bg-green-50',
                  'disabled:opacity-50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom */}
          <div className="mt-3">
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors"
              >
                Custom Amount
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.25"
                  min="0.1"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value)}
                  placeholder="e.g. 2.5"
                  autoFocus
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  onClick={handleCustomSave}
                  disabled={saving}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium"
                >
                  Save
                </button>
              </div>
            )}
          </div>

          {/* No Milk */}
          <button
            onClick={handleNoMilk}
            disabled={saving}
            className={clsx(
              'w-full mt-3 py-3 rounded-xl text-sm font-medium border-2 transition-all',
              entry?.status === 'no_milk'
                ? 'border-red-400 bg-red-50 text-red-600'
                : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600'
            )}
          >
            🚫 No Milk in this {batch === 'morning' ? 'Morning' : 'Evening'} Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Bulk No Milk Dialog ----
function BulkNoMilkDialog({
  customer,
  batch,
  onClose,
  onDone,
}: {
  customer: Customer;
  batch: Batch;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [targetBatch, setTargetBatch] = useState<'both' | 'morning' | 'evening'>(
    customer.batch === 'both' ? 'both' : batch
  );
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    if (!fromDate || !toDate) return toast.error('Select both dates');
    if (fromDate > toDate) return toast.error('From date must be before To date');
    setSaving(true);
    try {
      const applyBatch = targetBatch === 'both' ? undefined : targetBatch;
      await bulkNoMilk(customer.id, fromDate, toDate, applyBatch);
      toast.success(`🚫 No Milk applied for ${customer.name}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">No Milk — Date Range</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Mark <strong>{customer.name}</strong> as No Milk for a range of dates.
        </p>

        {customer.batch === 'both' && (
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Apply To:</label>
            <div className="flex gap-2">
              {(['both', 'morning', 'evening'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setTargetBatch(b)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize',
                    targetBatch === b ? 'bg-red-500 text-white border-red-500' : 'bg-gray-50 text-gray-600 border-gray-200'
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button
          onClick={handleApply}
          disabled={saving}
          className="w-full bg-red-500 text-white font-semibold py-3 rounded-xl text-sm hover:bg-red-600 disabled:opacity-60"
        >
          {saving ? 'Applying...' : 'Apply No Milk'}
        </button>
      </div>
    </div>
  );
}

// ---- Customer Row ----
function CustomerRow({
  customer,
  batch,
  entry,
  onEdit,
  onBulkNoMilk,
  onQuickSave,
  onStep,
}: {
  customer: Customer;
  batch: Batch;
  entry?: MilkEntry;
  onEdit: () => void;
  onBulkNoMilk: () => void;
  onQuickSave: (qty: number, status: 'delivered' | 'no_milk') => void;
  onStep: (delta: number) => void;
}) {
  const state =
    !entry
      ? 'not_entered'
      : entry.status === 'no_milk'
      ? 'no_milk'
      : 'completed';

  const defaultQty =
    batch === 'evening' && customer.batch === 'both'
      ? customer.default_quantity_evening_litre || 0.5
      : customer.default_quantity_litre;

  const currentQty = entry?.quantity_litre ?? defaultQty;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-md transition-shadow p-3.5 sm:p-4 flex flex-col justify-between gap-2.5">
      {/* Top row: Status icon, Name, Default & Action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0">
            {state === 'completed' && <CheckCircle2 size={24} className="text-green-500 shrink-0" />}
            {state === 'no_milk' && <XCircle size={24} className="text-gray-400 shrink-0" />}
            {state === 'not_entered' && <AlertCircle size={24} className="text-amber-400 shrink-0" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                {customer.name}
              </span>
              {customer.batch === 'both' && (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded">
                  Both
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap">
              {state === 'completed' && (
                <span className="text-green-600 dark:text-green-400 font-bold">
                  ✓ {formatQuantity(entry!.quantity_litre || 0)} delivered
                </span>
              )}
              {state === 'no_milk' && (
                <span className="text-gray-400 font-medium">🚫 No Milk</span>
              )}
              {state === 'not_entered' && (
                <span className="text-amber-500 font-medium">
                  ⚠ Not Entered • Def: {formatQuantity(defaultQty)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal / Custom Actions */}
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={onBulkNoMilk}
            title="No Milk Date Range"
            className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/60 hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Calendar size={15} />
          </button>
          <button
            onClick={onEdit}
            title="Custom quantity"
            className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700/60 hover:bg-green-50 text-gray-700 dark:text-gray-200 hover:text-green-700 rounded-lg text-xs font-semibold transition-colors"
          >
            ✏️ Custom
          </button>
        </div>
      </div>

      {/* 1-Tap Quick Quantity Bar (The Signature Feature) */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700/60 flex-wrap">
        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-400 mr-1">
          1-Tap:
        </span>

        {/* Default Quantity Pill */}
        <button
          type="button"
          onClick={() => onQuickSave(defaultQty, 'delivered')}
          className={clsx(
            'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 active:scale-95',
            state === 'completed' && Math.abs((entry?.quantity_litre || 0) - defaultQty) < 0.01
              ? 'bg-green-600 text-white border-green-600 shadow-xs'
              : 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100'
          )}
        >
          <span>⚡ Def ({formatQuantity(defaultQty)})</span>
        </button>

        {/* Preset Pills */}
        {[0.5, 1.0, 1.5, 2.0].map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => onQuickSave(val, 'delivered')}
            className={clsx(
              'px-2 py-1 rounded-lg text-xs font-bold transition-all border active:scale-95',
              state === 'completed' && Math.abs((entry?.quantity_litre || 0) - val) < 0.01
                ? 'bg-green-600 text-white border-green-600 shadow-xs'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
            )}
          >
            {val} L
          </button>
        ))}

        {/* Inline Stepper: -0.25 and +0.25 */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ml-auto">
          <button
            type="button"
            onClick={() => onStep(-0.25)}
            className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95"
            title="Decrease 0.25 L"
          >
            <Minus size={13} strokeWidth={2.5} />
          </button>
          <span className="px-1.5 text-[11px] font-mono font-bold text-gray-700 dark:text-gray-200">
            {state === 'completed' ? `${currentQty.toFixed(2)}L` : '±'}
          </span>
          <button
            type="button"
            onClick={() => onStep(0.25)}
            className="p-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95"
            title="Increase 0.25 L"
          >
            <Plus size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* No Milk */}
        <button
          type="button"
          onClick={() => onQuickSave(0, 'no_milk')}
          className={clsx(
            'px-2 py-1 rounded-lg text-xs font-bold transition-all border active:scale-95',
            state === 'no_milk'
              ? 'bg-red-600 text-white border-red-600 shadow-xs'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-red-600 border-gray-200 dark:border-gray-700 hover:bg-red-50'
          )}
          title="Mark No Milk today"
        >
          🚫 No Milk
        </button>
      </div>
    </div>
  );
}

export default function DailyEntryPage() {
  const [searchParams] = useSearchParams();
  const { customers } = useAppStore();
  const [batch, setBatch] = useState<Batch>(
    (searchParams.get('batch') as Batch) || 'morning'
  );

  // Selected date state (defaults to today)
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string>(format(today, 'yyyy-MM-dd'));

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [entries, setEntries] = useState<Map<string, MilkEntry>>(new Map());
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [bulkCustomer, setBulkCustomer] = useState<Customer | null>(null);
  const [showQuickBulk, setShowQuickBulk] = useState(false);
  const [loading, setLoading] = useState(true);

  const isToday = isSameDay(new Date(selectedDate + 'T00:00:00'), today);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getMilkEntriesForDate(selectedDate);
      // Key entries by customer_id:batch
      const map = new Map(list.map((e) => [`${e.customer_id}:${e.batch || 'morning'}`, e]));
      setEntries(map);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEntries();
    const handleFocus = () => loadEntries();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadEntries]);

  // Live real-time updates: when another device changes milk entries, reload immediately
  useRealtimeSubscription('azhagi_rt_milk_entries', () => {
    loadEntries();
  });

  // Date Navigation handlers
  const handlePrevDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const handleSetToday = () => {
    setSelectedDate(format(today, 'yyyy-MM-dd'));
  };

  // Customers receiving milk for the active batch
  const batchCustomers = customers.filter(
    (c) => c.batch === batch || c.batch === 'both'
  );

  const filtered = batchCustomers.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search);

    const entry = entries.get(`${c.id}:${batch}`);
    const state = !entry ? 'not_entered' : entry.status === 'no_milk' ? 'no_milk' : 'completed';
    const matchFilter =
      filter === 'all' ||
      (filter === 'completed' && state === 'completed') ||
      (filter === 'no_milk' && state === 'no_milk') ||
      (filter === 'not_entered' && state === 'not_entered');

    return matchSearch && matchFilter;
  });

  const handleSave = async (
    customer: Customer,
    qty: number | null,
    status: 'delivered' | 'no_milk'
  ) => {
    const saved = await upsertMilkEntry({
      customer_id: customer.id,
      entry_date: selectedDate,
      batch,
      quantity_litre: qty ?? undefined,
      status,
    });
    setEntries((prev) => new Map(prev).set(`${customer.id}:${batch}`, saved));
  };

  // 1-Tap Quick Save handler (Optimistic UI update + instant feedback)
  const handleQuickSave = async (
    customer: Customer,
    qty: number,
    status: 'delivered' | 'no_milk'
  ) => {
    const optimistic: MilkEntry = {
      id: entries.get(`${customer.id}:${batch}`)?.id || `temp-${Date.now()}`,
      owner_id: 'owner',
      customer_id: customer.id,
      entry_date: selectedDate,
      batch,
      quantity_litre: status === 'delivered' ? qty : undefined,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setEntries((prev) => new Map(prev).set(`${customer.id}:${batch}`, optimistic));
    toast.success(
      status === 'no_milk' ? `🚫 ${customer.name}: No Milk` : `✓ ${customer.name}: ${qty} L saved`,
      { id: `quick-${customer.id}` }
    );

    try {
      const saved = await upsertMilkEntry({
        customer_id: customer.id,
        entry_date: selectedDate,
        batch,
        quantity_litre: status === 'delivered' ? qty : undefined,
        status,
      });
      setEntries((prev) => new Map(prev).set(`${customer.id}:${batch}`, saved));
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    }
  };

  const handleStepCustomer = (customer: Customer, delta: number) => {
    const existing = entries.get(`${customer.id}:${batch}`);
    const defaultQty =
      batch === 'evening' && customer.batch === 'both'
        ? customer.default_quantity_evening_litre || 0.5
        : customer.default_quantity_litre;

    const base = existing && existing.status === 'delivered' ? (existing.quantity_litre || defaultQty) : defaultQty;
    const newQty = Math.max(0, parseFloat((base + delta).toFixed(2)));
    handleQuickSave(customer, newQty, newQty <= 0 ? 'no_milk' : 'delivered');
  };

  const handleBulkSaveAll = async (
    records: { customerId: string; qty: number; status: 'delivered' | 'no_milk' }[]
  ) => {
    for (const r of records) {
      await upsertMilkEntry({
        customer_id: r.customerId,
        entry_date: selectedDate,
        batch,
        quantity_litre: r.status === 'delivered' ? r.qty : undefined,
        status: r.status,
      });
    }
    toast.success(`✓ Saved entries for ${records.length} customers!`);
    await loadEntries();
  };

  const handleDeliverAllRemainingDefaults = async () => {
    const unentered = batchCustomers.filter((c) => !entries.has(`${c.id}:${batch}`));
    if (unentered.length === 0) return toast.success('All customers already entered!');

    for (const c of unentered) {
      const defaultQty =
        batch === 'evening' && c.batch === 'both'
          ? c.default_quantity_evening_litre || 0.5
          : c.default_quantity_litre;
      await upsertMilkEntry({
        customer_id: c.id,
        entry_date: selectedDate,
        batch,
        quantity_litre: defaultQty,
        status: 'delivered',
      });
    }
    toast.success(`✓ Marked ${unentered.length} customers with default deliveries!`);
    await loadEntries();
  };

  const totalLitres = Array.from(entries.values())
    .filter((e) => (e.batch || 'morning') === batch && e.status === 'delivered')
    .reduce((sum, e) => sum + (e.quantity_litre || 0), 0);

  const completed = batchCustomers.filter((c) => {
    const e = entries.get(`${c.id}:${batch}`);
    return e && e.status === 'delivered';
  }).length;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'not_entered', label: 'Not Entered' },
    { key: 'no_milk', label: 'No Milk' },
  ];

  const currentDateObj = new Date(selectedDate + 'T00:00:00');

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Date Navigation & Backfill Picker */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevDay}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
          >
            <ChevronLeft size={16} />
            Prev Day
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="font-bold text-gray-900 text-base">
                {format(currentDateObj, 'EEE, MMM d, yyyy')}
              </span>
              {isToday ? (
                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Today
                </span>
              ) : (
                <button
                  onClick={handleSetToday}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100"
                >
                  <RotateCcw size={10} />
                  Jump to Today
                </button>
              )}
            </div>
            {/* Native date input for past day picking */}
            <div className="mt-1 flex items-center justify-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-green-400"
              />
            </div>
          </div>

          <button
            onClick={handleNextDay}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
          >
            Next Day
            <ChevronRight size={16} />
          </button>
        </div>

        {!isToday && (
          <div className="mt-2 text-center text-xs text-amber-600 font-medium bg-amber-50 py-1 px-2 rounded-lg">
            ✍️ Recording / Editing entries for past date: <strong>{format(currentDateObj, 'MMMM d, yyyy')}</strong>
          </div>
        )}
      </div>

      {/* Batch Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setBatch('morning')}
          className={clsx(
            'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
            batch === 'morning' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
          )}
        >
          🌅 Morning Batch ({customers.filter((c) => c.batch === 'morning' || c.batch === 'both').length})
        </button>
        <button
          onClick={() => setBatch('evening')}
          className={clsx(
            'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
            batch === 'evening' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'
          )}
        >
          🌙 Evening Batch ({customers.filter((c) => c.batch === 'evening' || c.batch === 'both').length})
        </button>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="font-medium text-gray-700">
            {batch === 'morning' ? '🌅' : '🌙'} {batch === 'morning' ? 'Morning' : 'Evening'} Session
          </span>
          <span className="text-gray-500">
            {completed}/{batchCustomers.length} • {parseFloat(totalLitres.toFixed(2))} L
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{
              width: batchCustomers.length > 0 ? `${(completed / batchCustomers.length) * 100}%` : '0%',
            }}
          />
        </div>
      </div>

      {/* Quick Bulk Entry Action Bar */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-2xl p-4 sm:p-5 mb-4 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-amber-300 animate-pulse" />
            <h3 className="font-extrabold text-base sm:text-lg">Quick Bulk Entry (Signature Mode)</h3>
          </div>
          <p className="text-xs text-green-100 mt-1">
            Pre-fills all {batchCustomers.length} customer defaults with <strong>+ / -</strong> adjustments. Review and apply all at once, or use 1-tap on each card!
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowQuickBulk(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white text-green-800 font-black px-4 py-2.5 rounded-xl shadow-xs text-xs sm:text-sm hover:bg-green-50 active:scale-95 transition-all"
          >
            <Sparkles size={16} className="text-amber-500" />
            <span>Open Bulk Entry Sheet</span>
          </button>

          {batchCustomers.some((c) => !entries.has(`${c.id}:${batch}`)) && (
            <button
              type="button"
              onClick={handleDeliverAllRemainingDefaults}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-green-700/80 hover:bg-green-700 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs border border-green-400/40 active:scale-95 transition-all"
              title="Deliver default quantities to all remaining un-entered customers"
            >
              <span>⚡ Fill Remaining Defaults</span>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by name or phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              filter === f.key
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Customer list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">🥛</div>
          <p className="font-medium">No customers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((customer) => (
            <CustomerRow
              key={`${customer.id}:${batch}`}
              customer={customer}
              batch={batch}
              entry={entries.get(`${customer.id}:${batch}`)}
              onEdit={() => setEditingCustomer(customer)}
              onBulkNoMilk={() => setBulkCustomer(customer)}
              onQuickSave={(qty, status) => handleQuickSave(customer, qty, status)}
              onStep={(delta) => handleStepCustomer(customer, delta)}
            />
          ))}
        </div>
      )}

      {/* Quantity Picker Modal */}
      {editingCustomer && (
        <QuantityPicker
          customer={editingCustomer}
          batch={batch}
          entry={entries.get(`${editingCustomer.id}:${batch}`)}
          onSave={(qty, status) => handleSave(editingCustomer, qty, status)}
          onClose={() => setEditingCustomer(null)}
        />
      )}

      {/* Bulk No Milk Dialog */}
      {bulkCustomer && (
        <BulkNoMilkDialog
          customer={bulkCustomer}
          batch={batch}
          onClose={() => setBulkCustomer(null)}
          onDone={loadEntries}
        />
      )}

      {/* Quick Bulk Entry Sheet Modal (Signature Mode) */}
      <QuickBulkEntryModal
        isOpen={showQuickBulk}
        onClose={() => setShowQuickBulk(false)}
        date={selectedDate}
        batch={batch}
        customers={batchCustomers}
        entries={entries}
        onSaveAll={handleBulkSaveAll}
      />
    </div>
  );
}
