import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Share2,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Users,
  Milk,
  Receipt,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { getMonthlyBills, getOrCreateMonthlyBill, recalculateBill } from '../lib/api';
import type { MonthlyBill, Customer } from '../types';
import { formatCurrency } from '../types';
import {
  prepareStatementData,
  downloadOverallStatementPdf,
  printOverallStatement,
  shareOverallStatementWhatsApp,
  type OverallStatementData,
} from '../lib/overallStatementPdf';
import toast from 'react-hot-toast';

type BillWithCustomer = MonthlyBill & { customer: Customer };

export default function OverallBillStatementPage() {
  const navigate = useNavigate();
  const { settings, customers } = useAppStore();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [bills, setBills] = useState<BillWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const farmName = settings?.farm_name || 'Azhagi Farm';
  const defaultRate = settings?.default_rate || 60;
  const monthDate = new Date(year, month - 1, 1);
  const monthName = format(monthDate, 'MMMM yyyy');

  // Load bills for the selected month
  const loadStatementBills = async () => {
    setLoading(true);
    try {
      const data = await getMonthlyBills(year, month);
      setBills((data as BillWithCustomer[]) || []);
    } catch (err: any) {
      toast.error('Failed to load bill records: ' + (err?.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatementBills();
  }, [year, month]);

  // Transform raw bills into prepared structured statement data
  const statementData: OverallStatementData = prepareStatementData(
    bills,
    year,
    month,
    farmName
  );

  // Quick generate bills handler if the user is in a month with zero generated bills
  const handleGenerateMonthBills = async () => {
    setGenerating(true);
    try {
      const activeCustomers = customers.filter((c) => c.active);
      for (const c of activeCustomers) {
        const rate = c.custom_rate || defaultRate;
        const b = await getOrCreateMonthlyBill(c.id, year, month, rate);
        if (!b.is_finalized) await recalculateBill(b.id);
      }
      await loadStatementBills();
      toast.success(`✓ Generated bills for ${monthName}`);
    } catch (err: any) {
      toast.error('Error generating bills: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Download PDF handler
  const handleDownloadPdf = () => {
    if (statementData.rows.length === 0) {
      toast.error('No bill records found for this month.');
      return;
    }

    setPdfGenerating(true);
    try {
      downloadOverallStatementPdf(statementData);
      toast.success(`✓ Downloaded ${statementData.monthName} Statement PDF`);
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message);
    } finally {
      setPdfGenerating(false);
    }
  };

  // Print Preview handler
  const handlePrint = () => {
    if (statementData.rows.length === 0) {
      toast.error('No bill records found for this month.');
      return;
    }
    printOverallStatement(statementData);
  };

  // WhatsApp Share handler
  const handleShareWhatsApp = () => {
    if (statementData.rows.length === 0) {
      toast.error('No bill records found for this month.');
      return;
    }
    shareOverallStatementWhatsApp(statementData);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const hasRecords = statementData.rows.length > 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-7">
      {/* Top Header & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/bills')}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95 shadow-xs"
            title="Back to Customer Bills"
            aria-label="Back to Customer Bills"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-tight flex items-center gap-2">
              <span>Overall Bill Statement</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Single Ledger View
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Complete billing & pending balance statement for all customers in one place
            </p>
          </div>
        </div>

        {/* Action Buttons: PDF Download & Print */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={!hasRecords || loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/60 transition-all active:scale-95 disabled:opacity-40"
            title="Share summary via WhatsApp"
          >
            <Share2 size={16} />
            <span className="hidden xs:inline">WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!hasRecords || loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-40 shadow-xs"
            title="Print or view printable statement"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!hasRecords || loading || pdfGenerating}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
            title={hasRecords ? 'Download Overall Statement PDF' : 'No records to download'}
          >
            <Download size={18} />
            <span>{pdfGenerating ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Month Selector Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs px-4 sm:px-6 py-3.5 mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
          title="Previous Month"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="text-center">
          <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Selected Billing Period
          </div>
          <div className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
            {monthName}
          </div>
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

      {/* Summary Section Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
              Monthly Summary — {monthName}
            </h2>
          </div>
          {hasRecords && (
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              {statementData.totalPendingAmount <= 0 ? (
                <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={14} /> All Payments Cleared
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle size={14} /> Pending Collections Active
                </span>
              )}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Customers */}
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              <Users size={14} />
              <span>Customers</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
              {statementData.totalCustomers}
            </div>
          </div>

          {/* Total Milk */}
          <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/50 rounded-2xl border border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-semibold mb-1">
              <Milk size={14} />
              <span>Total Milk</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-800 dark:text-blue-300">
              {statementData.totalLitres} L
            </div>
          </div>

          {/* Total Bill */}
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              <Receipt size={14} />
              <span>Total Bill</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
              {formatCurrency(statementData.totalBillAmount)}
            </div>
          </div>

          {/* Collected */}
          <div className="p-3.5 bg-green-50/70 dark:bg-green-950/50 rounded-2xl border border-green-100 dark:border-green-900/40">
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-semibold mb-1">
              <CheckCircle2 size={14} />
              <span>Collected</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-green-700 dark:text-green-300">
              {formatCurrency(statementData.totalPaidAmount)}
            </div>
          </div>

          {/* Pending */}
          <div className="p-3.5 bg-red-50/80 dark:bg-red-950/60 rounded-2xl border border-red-100 dark:border-red-900/40 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-bold mb-1">
              <AlertCircle size={14} />
              <span>Pending</span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-300">
              {formatCurrency(statementData.totalPendingAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Statement Preview Table or Empty State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="w-9 h-9 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            Loading {monthName} Statement...
          </p>
        </div>
      ) : !hasRecords ? (
        /* Edge Case: No records found for this month */
        <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
            <Receipt size={32} />
          </div>
          <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
            No bill records found for this month.
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md mx-auto">
            There are no generated bills for <strong>{monthName}</strong> yet. You can generate bills from your daily milk delivery records with one tap below.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleGenerateMonthBills}
              disabled={generating}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-sm shadow-xs transition-all active:scale-95 disabled:opacity-60"
            >
              <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
              <span>{generating ? 'Calculating Bills...' : '⚡ Generate Bills for this Month'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Statement Table */
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white">
              Customer Billing & Payment Ledger ({statementData.rows.length} Customers)
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">
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
  );
}
