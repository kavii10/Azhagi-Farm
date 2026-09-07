import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Edit2,
  IndianRupee,
  Plus,
  ChevronLeft,
  ChevronRight,
  Lock,
  FileDown,
  Share2,
  Trash2,
} from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/appStore';
import ConfirmActionModal from '../components/ConfirmActionModal';
import {
  getCustomer,
  getMilkEntriesForCustomer,
  getOrCreateMonthlyBill,
  addPayment,
  getPaymentsForBill,
  upsertMilkEntry,
  finalizeBill,
  recalculateBill,
  deactivateCustomer,
  deleteCustomer,
} from '../lib/api';
import type { Customer, MilkEntry, MonthlyBill, Payment, Batch } from '../types';
import {
  formatQuantity,
  formatCurrency,
  getBillStatusColor,
  getBillStatusLabel,
  QUANTITY_OPTIONS,
} from '../types';
import { shareBillViaWhatsApp, downloadCustomerBillPdf } from '../lib/pdfGenerator';

// ---- Add Payment Modal ----
function AddPaymentModal({
  bill,
  customer,
  onClose,
  onSaved,
}: {
  bill: MonthlyBill;
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await addPayment({
        bill_id: bill.id,
        customer_id: customer.id,
        amount: val,
        payment_date: date,
        notes,
      });
      toast.success(`✓ ₹${val} payment recorded`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Add Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-500">Total Bill</span>
            <span className="font-semibold">{formatCurrency(bill.total_amount)}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-500">Already Paid</span>
            <span className="font-semibold text-green-600">{formatCurrency(bill.paid_amount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
            <span className="text-gray-500">Balance</span>
            <span className="font-bold text-red-500">{formatCurrency(bill.balance_amount)}</span>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={String(bill.balance_amount)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Cash payment / GPay"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl text-sm hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Payment'}
        </button>
      </div>
    </div>
  );
}

// ---- Edit Entry Modal ----
function EditEntryModal({
  customer,
  entry,
  date,
  batch,
  onClose,
  onSaved,
}: {
  customer: Customer;
  entry?: MilkEntry;
  date: string;
  batch: Batch;
  onClose: () => void;
  onSaved: (e: MilkEntry) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (qty: number | null, status: 'delivered' | 'no_milk') => {
    setSaving(true);
    try {
      const saved = await upsertMilkEntry({
        customer_id: customer.id,
        entry_date: date,
        batch,
        quantity_litre: qty ?? undefined,
        status,
      });
      toast.success(`Entry updated (${batch === 'morning' ? 'Morning' : 'Evening'})`);
      onSaved(saved);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">{format(new Date(date + 'T00:00:00'), 'MMM d, yyyy')}</h3>
              <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full capitalize">
                {batch}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Current: {!entry ? '—' : entry.status === 'no_milk' ? '🚫 No Milk' : formatQuantity(entry.quantity_litre || 0)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {QUANTITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value, 'delivered')}
              disabled={saving}
              className={clsx(
                'py-3 rounded-xl text-sm font-bold border-2 transition-all',
                entry?.status === 'delivered' && entry.quantity_litre === opt.value
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-green-400'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => handleSelect(null, 'no_milk')}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-all"
        >
          🚫 No Milk ({batch})
        </button>
      </div>
    </div>
  );
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings, removeCustomer } = useAppStore();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [bill, setBill] = useState<MonthlyBill | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [editEntry, setEditEntry] = useState<{ date: string; batch: Batch; entry?: MilkEntry } | null>(null);

  const defaultRate = settings?.default_rate || 60;

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, ents] = await Promise.all([
        getCustomer(id),
        getMilkEntriesForCustomer(id, viewYear, viewMonth),
      ]);
      setCustomer(c);
      setEntries(ents);

      const rate = c.custom_rate || defaultRate;

      // Try to get/create bill
      try {
        const b = await getOrCreateMonthlyBill(id, viewYear, viewMonth, rate);
        if (!b.is_finalized) {
          const updated = await recalculateBill(b.id);
          setBill(updated);
          const pmts = await getPaymentsForBill(updated.id);
          setPayments(pmts);
        } else {
          setBill(b);
          const pmts = await getPaymentsForBill(b.id);
          setPayments(pmts);
        }
      } catch {
        setBill(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, viewYear, viewMonth]);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete' | 'deactivate';
    title: string;
    message: string;
    checkboxLabel: string;
    confirmText: string;
  } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const handleDeactivate = () => {
    if (!customer) return;
    setConfirmModal({
      isOpen: true,
      type: 'deactivate',
      title: 'Confirm Customer Deactivation',
      message: `Are you sure you want to deactivate "${customer.name}"? They will be hidden from daily delivery lists.`,
      checkboxLabel: 'I understand and confirm that I want to deactivate this customer.',
      confirmText: 'Confirm Deactivation',
    });
  };

  const handleDelete = () => {
    if (!customer) return;
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      title: 'Confirm Permanent Deletion',
      message: `Are you sure you want to permanently delete "${customer.name}"? All recorded milk entries, bills, and payments will be erased completely.`,
      checkboxLabel: 'I understand that this action is irreversible and all data will be permanently deleted. I want to proceed.',
      confirmText: 'Permanently Delete Customer',
    });
  };

  const executeConfirmAction = async () => {
    if (!customer || !confirmModal) return;
    setModalLoading(true);
    try {
      if (confirmModal.type === 'delete') {
        await deleteCustomer(customer.id);
        removeCustomer(customer.id);
        toast.success('✓ Customer permanently deleted');
      } else {
        await deactivateCustomer(customer.id);
        removeCustomer(customer.id);
        toast.success('Customer deactivated');
      }
      navigate('/customers');
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setModalLoading(false);
      setConfirmModal(null);
    }
  };

  const handleFinalize = async () => {
    if (!bill) return;
    await finalizeBill(bill.id);
    await loadData();
    toast.success('Bill finalized and locked');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Customer not found</p>
      </div>
    );
  }

  // Index entries by date:batch
  const entryMap = new Map<string, MilkEntry>();
  entries.forEach((e) => {
    entryMap.set(`${e.entry_date}:${e.batch || 'morning'}`, e);
  });

  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth - 1));
  const totalLitres = entries
    .filter((e) => e.status === 'delivered')
    .reduce((sum, e) => sum + (e.quantity_litre || 0), 0);
  const rate = customer.custom_rate || defaultRate;
  const billAmount = parseFloat((totalLitres * rate).toFixed(2));

  const monthName = format(new Date(viewYear, viewMonth - 1), 'MMMM yyyy');

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back + Edit */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-medium"
        >
          <ArrowLeft size={18} />
          Customers
        </button>
        <button
          onClick={() => navigate(`/customers/${customer.id}/edit`)}
          className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-medium"
        >
          <Edit2 size={16} />
          Edit Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Card & Summary (5 cols on laptop) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                <span className="text-green-700 font-bold text-2xl">{customer.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{customer.name}</h2>
                  {customer.batch === 'both' && (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
                      Both Batches
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {customer.batch === 'both'
                    ? '☀️ Morning & 🌙 Evening'
                    : customer.batch === 'morning'
                    ? '🌅 Morning Only'
                    : '🌙 Evening Only'}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {customer.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={15} className="text-gray-400" />
                  {customer.phone}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={15} className="text-gray-400" />
                  {customer.address}
                </div>
              )}
              {customer.batch === 'both' ? (
                <div className="flex flex-col gap-1 text-gray-600">
                  <div>🌅 Morning Default: <strong>{formatQuantity(customer.default_quantity_litre)}</strong></div>
                  <div>🌙 Evening Default: <strong>{formatQuantity(customer.default_quantity_evening_litre || 0.5)}</strong></div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="text-gray-400">🥛</span>
                  Default Quantity: <strong>{formatQuantity(customer.default_quantity_litre)}</strong>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <IndianRupee size={15} className="text-gray-400" />
                Rate: ₹{rate}/L {customer.custom_rate ? '(Custom Rate)' : '(Default Rate)'}
              </div>
            </div>
          </div>

          {/* Monthly Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">{monthName} Summary</h3>
          {bill?.is_finalized && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              <Lock size={11} /> Finalized
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-gray-900">{parseFloat(totalLitres.toFixed(2))} L</div>
            <div className="text-xs text-gray-400 mt-0.5">Total Milk Delivered</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-gray-900">{formatCurrency(billAmount)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Calculated Bill</div>
          </div>
        </div>

        {bill && (
          <>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Bill</span>
                <span className="font-semibold">{formatCurrency(bill.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Paid</span>
                <span className="font-semibold text-green-600">{formatCurrency(bill.paid_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-500">Balance</span>
                <span className={clsx('font-bold', bill.balance_amount > 0 ? 'text-red-500' : 'text-green-600')}>
                  {formatCurrency(bill.balance_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={clsx('font-bold', getBillStatusColor(bill.status))}>
                  {getBillStatusLabel(bill.status)}
                </span>
              </div>
            </div>

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment History</p>
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-500">{format(new Date(p.payment_date), 'MMM d, yyyy')}</span>
                    <span className="font-medium text-green-600">+{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {bill && bill.balance_amount > 0 && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-green-700 shadow-sm"
            >
              <Plus size={16} />
              Add Payment
            </button>
          )}
          {bill && !bill.is_finalized && (
            <button
              onClick={handleFinalize}
              className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200"
              title="Finalize and lock this month's bill"
            >
              <Lock size={16} />
            </button>
          )}
        </div>

        {/* Bill Download & WhatsApp Sharing Section */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={async () => {
              try {
                const res = await downloadCustomerBillPdf({
                  farmName: settings?.farm_name || 'Azhagi Farm',
                  customer,
                  bill: bill || undefined,
                  entries,
                  year: viewYear,
                  month: viewMonth,
                  rate,
                });
                toast.success(`✓ Saved to ${res?.folder || 'Downloads'}: ${res?.fileName || 'Bill.pdf'}`, { duration: 4000 });
              } catch (err: any) {
                toast.error('Failed to download PDF: ' + err.message);
              }
            }}
            className="flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 py-2.5 px-3 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors active:scale-95"
          >
            <FileDown size={16} />
            Download PDF Bill
          </button>
          <button
            onClick={() =>
              shareBillViaWhatsApp({
                farmName: settings?.farm_name || 'Azhagi Farm',
                customer,
                bill: bill || undefined,
                entries,
                year: viewYear,
                month: viewMonth,
                rate,
              })
            }
            className="flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-800 py-2.5 px-3 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors"
          >
            <Share2 size={16} />
            Share via WhatsApp
          </button>
        </div>
      </div>

      {/* Danger Zone: Deactivate and Delete */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-red-700 mb-3">Customer Actions</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDeactivate}
            className="flex-1 text-xs font-semibold py-2 px-3 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors text-center"
          >
            Deactivate
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-center"
          >
            <Trash2 size={14} />
            Permanently Delete
          </button>
        </div>
      </div>
    </div>

    {/* Right Column: Month Navigator & Milk History (7 cols on laptop) */}
    <div className="lg:col-span-7 space-y-4">
      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-xs px-5 py-3.5">
        <button
          onClick={() => {
            if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
            else setViewMonth(m => m - 1);
          }}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-bold text-gray-900 text-base sm:text-lg">{monthName}</span>
        <button
          onClick={() => {
            if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
            else setViewMonth(m => m + 1);
          }}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Milk History Calendar List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">Milk History — {monthName}</h3>
        <div className="space-y-1">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const mEntry = entryMap.get(`${dateStr}:morning`);
            const eEntry = entryMap.get(`${dateStr}:evening`);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isFuture = new Date(dateStr + 'T00:00:00') > new Date();

            return (
              <div
                key={dateStr}
                className={clsx(
                  'flex items-center justify-between py-2 px-2.5 rounded-lg text-xs sm:text-sm border-b border-gray-50 last:border-0',
                  isToday && 'bg-green-50/70 font-medium'
                )}
              >
                <span className={clsx('text-gray-500 w-16 flex-shrink-0', isToday && 'font-bold text-green-700')}>
                  {format(new Date(dateStr + 'T00:00:00'), 'MMM d')}
                </span>

                <div className="flex-1 flex justify-center items-center gap-3">
                  {isFuture ? (
                    <span className="text-gray-300">—</span>
                  ) : customer.batch === 'both' ? (
                    <>
                      {/* Morning pill */}
                      <button
                        onClick={() => setEditEntry({ date: dateStr, batch: 'morning', entry: mEntry })}
                        className="px-2 py-0.5 rounded-md hover:bg-orange-50 transition-colors"
                      >
                        <span className="text-gray-400 mr-1">🌅</span>
                        {!mEntry ? (
                          <span className="text-amber-500">⚠ Not Entered</span>
                        ) : mEntry.status === 'no_milk' ? (
                          <span className="text-gray-400">🚫 No Milk</span>
                        ) : (
                          <span className="font-semibold text-gray-800">{formatQuantity(mEntry.quantity_litre || 0)}</span>
                        )}
                      </button>

                      {/* Evening pill */}
                      <button
                        onClick={() => setEditEntry({ date: dateStr, batch: 'evening', entry: eEntry })}
                        className="px-2 py-0.5 rounded-md hover:bg-purple-50 transition-colors"
                      >
                        <span className="text-gray-400 mr-1">🌙</span>
                        {!eEntry ? (
                          <span className="text-amber-500">⚠ Not Entered</span>
                        ) : eEntry.status === 'no_milk' ? (
                          <span className="text-gray-400">🚫 No Milk</span>
                        ) : (
                          <span className="font-semibold text-gray-800">{formatQuantity(eEntry.quantity_litre || 0)}</span>
                        )}
                      </button>
                    </>
                  ) : (
                    /* Single batch */
                    <button
                      onClick={() =>
                        setEditEntry({
                          date: dateStr,
                          batch: customer.batch === 'evening' ? 'evening' : 'morning',
                          entry: customer.batch === 'evening' ? eEntry : mEntry,
                        })
                      }
                      className="px-2 py-0.5 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      {customer.batch === 'evening' ? (
                        !eEntry ? (
                          <span className="text-amber-500">⚠ Not Entered</span>
                        ) : eEntry.status === 'no_milk' ? (
                          <span className="text-gray-400">🚫 No Milk</span>
                        ) : (
                          <span className="font-semibold text-gray-800">{formatQuantity(eEntry.quantity_litre || 0)}</span>
                        )
                      ) : (
                        !mEntry ? (
                          <span className="text-amber-500">⚠ Not Entered</span>
                        ) : mEntry.status === 'no_milk' ? (
                          <span className="text-gray-400">🚫 No Milk</span>
                        ) : (
                          <span className="font-semibold text-gray-800">{formatQuantity(mEntry.quantity_litre || 0)}</span>
                        )
                      )}
                    </button>
                  )}
                </div>

                {!isFuture && (
                  <span className="text-gray-300 text-[10px] hidden sm:inline">tap to edit</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold">
          <span className="text-gray-600">Total Month Milk</span>
          <span className="text-gray-900">{parseFloat(totalLitres.toFixed(2))} L</span>
        </div>
      </div>
    </div>
  </div>

      {/* Modals */}
      {showPayment && bill && (
        <AddPaymentModal
          bill={bill}
          customer={customer}
          onClose={() => setShowPayment(false)}
          onSaved={loadData}
        />
      )}

      {editEntry && (
        <EditEntryModal
          customer={customer}
          entry={editEntry.entry}
          date={editEntry.date}
          batch={editEntry.batch}
          onClose={() => setEditEntry(null)}
          onSaved={(e) => {
            setEntries((prev) => {
              const idx = prev.findIndex(
                (x) => x.entry_date === e.entry_date && (x.batch || 'morning') === (e.batch || 'morning')
              );
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = e;
                return copy;
              }
              return [...prev, e];
            });
            setEditEntry(null);
            loadData();
          }}
        />
      )}

      {confirmModal && (
        <ConfirmActionModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          itemName={customer.name}
          actionType={confirmModal.type}
          message={confirmModal.message}
          checkboxLabel={confirmModal.checkboxLabel}
          confirmText={confirmModal.confirmText}
          onConfirm={executeConfirmAction}
          onClose={() => setConfirmModal(null)}
          loading={modalLoading}
        />
      )}
    </div>
  );
}
