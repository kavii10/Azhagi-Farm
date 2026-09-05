import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  FileDown,
  Share2,
  FileText,
  Users,
  Download,
  Printer,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { getMonthlyBills, getOrCreateMonthlyBill, recalculateBill, getMilkEntriesForCustomer, addPayment } from '../lib/api';
import { useAppStore } from '../store/appStore';
import type { MonthlyBill, Customer } from '../types';
import { formatCurrency, getBillStatusLabel, getBillStatusColor } from '../types';
import { downloadCustomerBillPdf, shareBillViaWhatsApp } from '../lib/pdfGenerator';
import {
  prepareStatementData,
  downloadOverallStatementPdf,
  printOverallStatement,
  shareOverallStatementWhatsApp,
} from '../lib/overallStatementPdf';
import { useRealtimeSubscription } from '../lib/realtimeSync';
import toast from 'react-hot-toast';

type BillRow = MonthlyBill & { customer: Customer };
type FilterStatus = 'all' | 'paid' | 'partial' | 'pending';
type FilterBatch = 'all' | 'morning' | 'evening' | 'both';

export default function MonthlyBillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, customers } = useAppStore();
  const now = new Date();

  const [activeTab, setActiveTab] = useState<'individual' | 'overall'>(
    searchParams.get('tab') === 'overall' ? 'overall' : 'individual'
  );

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingOverallPdf, setDownloadingOverallPdf] = useState(false);
  const [downloadingBillId, setDownloadingBillId] = useState<string | null>(null);

  // Filters for Individual Bills tab
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterBatch] = useState<FilterBatch>('all');

  // Quick Payment Modal state
  const [paymentBill, setPaymentBill] = useState<BillRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const farmName = settings?.farm_name || 'Azhagi Farm';
  const defaultRate = settings?.default_rate || 60;
  const monthName = format(new Date(year, month - 1), 'MMMM yyyy');

  const loadBills = async () => {
    setLoading(true);
    try {
      const data = await getMonthlyBills(year, month);
      setBills(data as BillRow[]);
    } catch (err: any) {
      toast.error('Failed to load bills: ' + (err?.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
    const handleFocus = () => loadBills();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [year, month]);

  // Live real-time updates: refresh bills when bills or payments are updated from any device
  useRealtimeSubscription('azhagi_rt_monthly_bills', () => {
    loadBills();
  });
  useRealtimeSubscription('azhagi_rt_payments', () => {
    loadBills();
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const activeCustomers = customers.filter((c) => c.active);
      for (const c of activeCustomers) {
        const rate = c.custom_rate || defaultRate;
        const b = await getOrCreateMonthlyBill(c.id, year, month, rate);
        if (!b.is_finalized) await recalculateBill(b.id);
      }
      await loadBills();
      toast.success(`✓ Generated bills for ${monthName}`);
    } catch (err: any) {
      toast.error('Error generating bills: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Download individual customer PDF invoice
  const handleDownloadIndividualPdf = async (e: React.MouseEvent, bill: BillRow) => {
    e.stopPropagation();
    setDownloadingBillId(bill.id);
    try {
      const entries = await getMilkEntriesForCustomer(bill.customer_id, year, month);
      await downloadCustomerBillPdf({
        farmName,
        customer: bill.customer,
        bill,
        entries,
        year,
        month,
        rate: bill.rate_per_litre,
      });
      toast.success(`✓ Downloaded ${bill.customer.name}'s Bill`);
    } catch (err: any) {
      toast.error('Failed to download PDF: ' + err.message);
    } finally {
      setDownloadingBillId(null);
    }
  };

  // Share individual customer bill via WhatsApp
  const handleShareWhatsApp = async (e: React.MouseEvent, bill: BillRow) => {
    e.stopPropagation();
    try {
      const entries = await getMilkEntriesForCustomer(bill.customer_id, year, month);
      shareBillViaWhatsApp({
        farmName,
        customer: bill.customer,
        bill,
        entries,
        year,
        month,
        rate: bill.rate_per_litre,
      });
    } catch (err: any) {
      toast.error('Failed to share bill: ' + err.message);
    }
  };

  // Add quick payment
  const handleSavePayment = async () => {
    if (!paymentBill) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setSavingPayment(true);
    try {
      await addPayment({
        bill_id: paymentBill.id,
        customer_id: paymentBill.customer_id,
        amount: amt,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
      });
      toast.success(`✓ Added payment of ${formatCurrency(amt)} for ${paymentBill.customer.name}`);
      setPaymentBill(null);
      setPaymentAmount('');
      await loadBills();
    } catch (err: any) {
      toast.error('Failed to save payment: ' + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  // Filtered bills for individual tab
  const filtered = bills.filter((b) => {
    const matchSearch = !search || b.customer.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    const matchBatch =
      filterBatch === 'all' ||
      (filterBatch === 'both' && b.customer.batch === 'both') ||
      (filterBatch === 'morning' && (b.customer.batch === 'morning' || b.customer.batch === 'both')) ||
      (filterBatch === 'evening' && (b.customer.batch === 'evening' || b.customer.batch === 'both'));

    return matchSearch && matchStatus && matchBatch;
  });

  // Dynamic Overall Statement data calculation
  const statementData = prepareStatementData(bills, year, month, farmName);
  const hasRecords = statementData.rows.length > 0;

  // Download overall statement PDF handler
  const handleDownloadOverallPdf = async () => {
    if (!hasRecords) {
      toast.error('No bill records found for this month.');
      return;
    }
    setDownloadingOverallPdf(true);
    try {
      await downloadOverallStatementPdf(statementData);
      toast.success(`✓ Downloaded ${statementData.monthName} Overall Statement`);
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message);
    } finally {
      setDownloadingOverallPdf(false);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: '🟢 Paid' },
    { key: 'partial', label: '🟡 Partial' },
    { key: 'pending', label: '🔴 Pending' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
            Monthly Bills & Ledger
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Billing period: <strong className="text-gray-800 dark:text-gray-200">{monthName}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold disabled:opacity-60 shadow-xs transition-colors shrink-0 active:scale-95"
        >
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
          <span>{generating ? 'Generating Calculations...' : '⚡ Generate / Update Bills'}</span>
        </button>
      </div>

      {/* View Selector Tabs: Customer Bills vs Overall Statement */}
      <div className="flex bg-gray-200/80 dark:bg-gray-800/90 p-1.5 rounded-2xl mb-5 max-w-md shadow-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab('individual');
            setSearchParams({});
          }}
          className={clsx(
            'flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all',
            activeTab === 'individual'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          <Users size={16} />
          <span>Customer Bills</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('overall');
            setSearchParams({ tab: 'overall' });
          }}
          className={clsx(
            'flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all',
            activeTab === 'overall'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          )}
        >
          <FileText size={16} />
          <span>Overall Statement</span>
        </button>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs px-4 sm:px-6 py-3 mb-5">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
          title="Previous Month"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
            Billing Month
          </span>
          <span className="font-extrabold text-gray-900 dark:text-white text-base sm:text-lg">
            {monthName}
          </span>
        </div>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
          title="Next Month"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERALL BILL STATEMENT (Integrated inside Monthly Bills) */}
      {/* ========================================================================= */}
      {activeTab === 'overall' && (
        <div>
          {/* Monthly Summary Cards */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-4 sm:p-6 mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
                  Overall Monthly Statement — {monthName}
                </h2>
              </div>

              {/* Action Buttons for Overall Statement */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => shareOverallStatementWhatsApp(statementData)}
                  disabled={!hasRecords || loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/60 transition-all active:scale-95 disabled:opacity-40"
                  title="Share summary via WhatsApp"
                >
                  <Share2 size={15} />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => printOverallStatement(statementData)}
                  disabled={!hasRecords || loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-40 shadow-xs"
                  title="Print statement"
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadOverallPdf}
                  disabled={!hasRecords || loading || downloadingOverallPdf}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  title="Download clean A4 PDF Statement"
                >
                  <Download size={15} />
                  <span>{downloadingOverallPdf ? 'Downloading...' : 'Download PDF'}</span>
                </button>
              </div>
            </div>

            {/* 5 Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold mb-0.5">Customers</div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                  {statementData.totalCustomers}
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/50 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold mb-0.5">Total Milk</div>
                <div className="text-xl sm:text-2xl font-black text-blue-800 dark:text-blue-300">
                  {statementData.totalLitres} L
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border border-gray-100 dark:border-gray-800">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold mb-0.5">Total Bill</div>
                <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                  {formatCurrency(statementData.totalBillAmount)}
                </div>
              </div>

              <div className="p-3 bg-green-50/70 dark:bg-green-950/50 rounded-2xl border border-green-100 dark:border-green-900/40">
                <div className="text-[11px] text-green-700 dark:text-green-400 font-semibold mb-0.5">Collected</div>
                <div className="text-xl sm:text-2xl font-black text-green-700 dark:text-green-300">
                  {formatCurrency(statementData.totalPaidAmount)}
                </div>
              </div>

              <div className="p-3 bg-red-50/80 dark:bg-red-950/60 rounded-2xl border border-red-100 dark:border-red-900/40 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-red-600 dark:text-red-400 font-bold mb-0.5">Pending</div>
                <div className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-300">
                  {formatCurrency(statementData.totalPendingAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Statement Table or Empty State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-bold text-gray-400">Loading {monthName} Statement...</p>
            </div>
          ) : !hasRecords ? (
            <div className="text-center py-14 px-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs">
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-200 dark:border-amber-800">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                No bill records found for this month.
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                No bills have been generated for {monthName} yet. Click below to automatically calculate bills from daily delivery records.
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-xs transition-all active:scale-95 disabled:opacity-60"
                >
                  <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                  <span>{generating ? 'Calculating...' : '⚡ Generate Bills for this Month'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">
                  Customer Billing & Payment Ledger ({statementData.rows.length} Customers)
                </h3>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  Sorted by: Morning, Evening & Name
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 font-extrabold border-b border-gray-200 dark:border-gray-700">
                      <th className="py-3 px-3 text-center w-12">No.</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-3 text-center">Batch</th>
                      <th className="py-3 px-3 text-right">Total Litres</th>
                      <th className="py-3 px-3 text-right">Rate/L</th>
                      <th className="py-3 px-3 text-right">Total Bill</th>
                      <th className="py-3 px-3 text-right">Paid</th>
                      <th className="py-3 px-3 text-right font-extrabold">Pending</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {statementData.rows.map((row) => (
                      <tr
                        key={row.customerId}
                        className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3 px-3 text-center text-gray-400 dark:text-gray-500 font-medium">
                          {row.no}
                        </td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                          {row.customerName}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={clsx(
                              'inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold',
                              row.batch === 'Morning' &&
                                'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300',
                              row.batch === 'Evening' &&
                                'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300',
                              row.batch.includes('&') &&
                                'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            )}
                          >
                            {row.batch}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                          {row.totalLitres} L
                        </td>
                        <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">
                          ₹{row.ratePerLitre}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(row.totalBill)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(row.paidAmount)}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-red-600 dark:text-red-400">
                          {formatCurrency(row.pendingAmount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={clsx(
                              'inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase',
                              row.status === 'PAID' &&
                                'bg-green-100 dark:bg-green-950/70 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800',
                              row.status === 'PARTIALLY PAID' &&
                                'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
                              row.status === 'PENDING' &&
                                'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Final TOTAL Row */}
                  <tfoot>
                    <tr className="bg-emerald-800 dark:bg-emerald-950 text-white font-black border-t-2 border-emerald-900">
                      <td className="py-3.5 px-3 text-center font-extrabold">TOTAL</td>
                      <td className="py-3.5 px-4 font-black">
                        {statementData.totalCustomers} Customers
                      </td>
                      <td className="py-3.5 px-3 text-center text-emerald-200">—</td>
                      <td className="py-3.5 px-3 text-right text-emerald-100">
                        {statementData.totalLitres} L
                      </td>
                      <td className="py-3.5 px-3 text-right text-emerald-200">—</td>
                      <td className="py-3.5 px-3 text-right">
                        {formatCurrency(statementData.totalBillAmount)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-emerald-300">
                        {formatCurrency(statementData.totalPaidAmount)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-red-200">
                        {formatCurrency(statementData.totalPendingAmount)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-white/20 text-white">
                          {statementData.totalPendingAmount <= 0 ? 'ALL CLEAR' : 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INDIVIDUAL CUSTOMER BILLS CARDS */}
      {/* ========================================================================= */}
      {activeTab === 'individual' && (
        <div>
          {/* Summary Cards */}
          {bills.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-4 sm:p-5 mb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5 font-medium">Customers Billed</div>
                  <div className="text-xl font-extrabold text-gray-900 dark:text-white">{bills.length}</div>
                </div>
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/50 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                  <div className="text-[11px] text-blue-700 dark:text-blue-400 mb-0.5 font-semibold">Total Milk</div>
                  <div className="text-xl font-extrabold text-blue-800 dark:text-blue-300">{statementData.totalLitres} L</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5 font-medium">Expected Revenue</div>
                  <div className="text-xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(statementData.totalBillAmount)}</div>
                </div>
                <div className="p-3 bg-green-50/70 dark:bg-green-950/50 rounded-2xl border border-green-100 dark:border-green-900/40">
                  <div className="text-[11px] text-green-700 dark:text-green-400 mb-0.5 font-semibold">Collected</div>
                  <div className="text-xl font-extrabold text-green-700 dark:text-green-300">{formatCurrency(statementData.totalPaidAmount)}</div>
                </div>
                <div className="p-3 bg-red-50/80 dark:bg-red-950/60 rounded-2xl border border-red-100 dark:border-red-900/40 col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-red-600 dark:text-red-400 mb-0.5 font-bold">Net Outstanding</div>
                  <div className="text-xl font-extrabold text-red-600 dark:text-red-300">{formatCurrency(statementData.totalPendingAmount)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer by name..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterStatus(f.key)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
                  filterStatus === f.key
                    ? 'bg-green-600 text-white'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Customer Bills Grid */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 px-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs">
              <div className="text-4xl mb-3">🧾</div>
              <p className="font-extrabold text-gray-700 dark:text-gray-200 text-base">No bills found for {monthName}</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Click "⚡ Generate / Update Bills" above to calculate totals from daily delivery records.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filtered.map((bill) => (
                <div
                  key={bill.id}
                  onClick={() => {
                    setPaymentBill(bill);
                    setPaymentAmount(bill.balance_amount > 0 ? bill.balance_amount.toString() : '');
                  }}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-4 hover:border-green-300 dark:hover:border-green-700 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white">
                          {bill.customer.name}
                        </h4>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500">
                          {bill.customer.phone || 'No phone'} • Rate: ₹{bill.rate_per_litre}/L
                        </div>
                      </div>
                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', getBillStatusColor(bill.status))}>
                        {getBillStatusLabel(bill.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl">
                      <div>
                        <div className="text-[10px] text-gray-400">Total Bill</div>
                        <div className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                          {formatCurrency(bill.total_amount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400">Paid</div>
                        <div className="font-bold text-green-700 dark:text-green-400 text-xs sm:text-sm">
                          {formatCurrency(bill.paid_amount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400">Balance</div>
                        <div className={clsx('font-extrabold text-xs sm:text-sm', bill.balance_amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400')}>
                          {formatCurrency(bill.balance_amount)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action buttons */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={(e) => handleDownloadIndividualPdf(e, bill)}
                      disabled={downloadingBillId === bill.id}
                      className="flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 py-1.5 px-2.5 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                      title="Download clean PDF invoice"
                    >
                      <FileDown size={14} />
                      <span>{downloadingBillId === bill.id ? 'Downloading...' : 'Download PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleShareWhatsApp(e, bill)}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 py-1.5 px-2.5 rounded-lg transition-colors active:scale-95"
                      title="Share bill details on WhatsApp"
                    >
                      <Share2 size={14} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending summary banner */}
          {filtered.some((b) => b.balance_amount > 0) && (
            <div className="mt-6 bg-red-50 dark:bg-red-950/40 rounded-2xl p-4 border border-red-100 dark:border-red-900/50">
              <p className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-400 mb-2">🔴 Pending Payments Summary</p>
              {filtered
                .filter((b) => b.balance_amount > 0)
                .map((b) => (
                  <div key={b.id} className="flex justify-between text-xs sm:text-sm py-1 border-b border-red-100/50 dark:border-red-900/30 last:border-0">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{b.customer.name}</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(b.balance_amount)}</span>
                  </div>
                ))}
              <div className="flex justify-between text-xs sm:text-sm font-extrabold border-t border-red-200 dark:border-red-900/50 mt-2.5 pt-2">
                <span>Total Outstanding</span>
                <span className="text-red-600 dark:text-red-400">
                  {formatCurrency(
                    filtered
                      .filter((b) => b.balance_amount > 0)
                      .reduce((s, b) => s + b.balance_amount, 0)
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Record Payment Modal */}
      {paymentBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-5 sm:p-6 w-full max-w-sm">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-1">
              Record Payment
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Customer: <strong className="text-gray-900 dark:text-white">{paymentBill.customer.name}</strong> • Balance: <span className="font-bold text-red-600">{formatCurrency(paymentBill.balance_amount)}</span>
            </p>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Amount Paid (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount paid"
                className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentBill(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePayment}
                disabled={savingPayment}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold shadow-xs transition-colors disabled:opacity-50"
              >
                {savingPayment ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
