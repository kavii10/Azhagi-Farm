import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Milk, Sunrise, Moon, Plus, IndianRupee, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { getDashboardStats, getMonthlyBills } from '../lib/api';
import { useAppStore } from '../store/appStore';
import { formatCurrency } from '../types';
import { getTodayFarmYield, getAnimals, syncCattleWithCloud } from '../lib/cattleStore';
import { useRealtimeSubscription } from '../lib/realtimeSync';

const TAGLINE = 'Fresh from Our Farm to Your Family';

function StatCard({
  icon,
  label,
  value,
  sub,
  color = 'green',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-600 border-green-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    teal: 'bg-teal-50 text-teal-600 border-teal-100',
  };
  return (
    <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 hover:shadow-md transition-shadow">
      <div className={`inline-flex p-2.5 rounded-xl border ${colorMap[color]} mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900 tracking-tight">{value}</div>
      <div className="text-xs sm:text-sm font-medium text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-1 truncate">{sub}</div>}
    </div>
  );
}

function ProgressBar({ completed, total, label }: { completed: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="text-gray-500 font-medium">
          {completed} / {total} customers ({pct}%)
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden p-0.5">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { settings } = useAppStore();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const [stats, setStats] = useState<any>(null);
  const [billSummary, setBillSummary] = useState<{
    expected: number;
    collected: number;
    pending: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cattleYield, setCattleYield] = useState({ total: 0, morning: 0, evening: 0 });
  const [milkingCount, setMilkingCount] = useState(0);

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const load = async () => {
    try {
      const [s, bills] = await Promise.all([
        getDashboardStats(todayStr),
        getMonthlyBills(year, month),
      ]);
      setStats(s);

      const expected = bills.reduce((sum: number, b: any) => sum + b.total_amount, 0);
      const collected = bills.reduce((sum: number, b: any) => sum + b.paid_amount, 0);
      setBillSummary({
        expected: parseFloat(expected.toFixed(2)),
        collected: parseFloat(collected.toFixed(2)),
        pending: parseFloat((expected - collected).toFixed(2)),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Cattle
    setCattleYield(getTodayFarmYield(todayStr));
    setMilkingCount(getAnimals().filter((a) => a.status === 'milking').length);
    load();
    syncCattleWithCloud().then(() => {
      setCattleYield(getTodayFarmYield(todayStr));
      setMilkingCount(getAnimals().filter((a) => a.status === 'milking').length);
    });
    const handleFocus = () => load();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [todayStr, year, month]);

  // Live real-time updates: refresh dashboard when changes occur on any device
  useRealtimeSubscription('azhagi_rt_any', () => {
    load();
  });

  const monthName = format(today, 'MMMM yyyy');

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Farm Branding Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Azhagi Farm Milk"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-2xl shadow-xs shrink-0 border border-green-100"
          />
          <div className="min-w-0">
            <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{greeting} 👋</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              {settings?.farm_name || 'Azhagi Farm'}
            </h1>
            <p className="text-green-600 text-xs sm:text-sm font-medium italic mt-0.5">{TAGLINE}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="text-left sm:text-right">
            <div className="text-xs text-gray-400">Date</div>
            <div className="text-sm font-bold text-gray-800">{format(today, 'EEEE, MMMM d, yyyy')}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* STATS GRID (Laptop: 6 cols, Tablet: 3 cols, Mobile: 2 cols) */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
            <StatCard
              icon={<Users size={20} />}
              label="Total Customers"
              value={String(stats?.totalCustomers || 0)}
              sub="Active subscribers"
              color="blue"
            />
            <StatCard
              icon={<Milk size={20} />}
              label="Today's Milk Sold"
              value={`${stats?.todayMilk || 0} L`}
              sub="Customer delivery"
              color="green"
            />
            <StatCard
              icon={<Sunrise size={20} />}
              label="Morning Session"
              value={`${stats?.morning?.litres || 0} L`}
              sub={`${stats?.morning?.completed || 0} / ${stats?.morning?.total || 0} entered`}
              color="orange"
            />
            <StatCard
              icon={<Moon size={20} />}
              label="Evening Session"
              value={`${stats?.evening?.litres || 0} L`}
              sub={`${stats?.evening?.completed || 0} / ${stats?.evening?.total || 0} entered`}
              color="purple"
            />
            <StatCard
              icon={<span className="text-xl">🐄</span>}
              label="Farm Yield Today"
              value={`${cattleYield.total} L`}
              sub={`${milkingCount} cattle milking`}
              color="teal"
            />
            <StatCard
              icon={<span className="text-xl">🌱</span>}
              label="Sold vs Produced"
              value={
                cattleYield.total > 0
                  ? `${Math.min(100, Math.round(((stats?.todayMilk || 0) / cattleYield.total) * 100))}%`
                  : '—'
              }
              sub="Production utilized"
              color="green"
            />
          </div>

          {/* ============================================================ */}
          {/* MAIN CONTENT 2-COLUMN LAYOUT ON LAPTOP */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Left Column: Today's Milk Entry (7 cols on laptop) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Today's Milk Delivery</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Quick entry progress by delivery session</p>
                  </div>
                  <span className="text-xs font-semibold bg-green-50 text-green-700 px-3 py-1 rounded-full">
                    Live Status
                  </span>
                </div>

                <ProgressBar
                  completed={stats?.morning?.completed || 0}
                  total={stats?.morning?.total || 0}
                  label="🌅 Morning Batch"
                />
                <ProgressBar
                  completed={stats?.evening?.completed || 0}
                  total={stats?.evening?.total || 0}
                  label="🌙 Evening Batch"
                />

                <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => navigate('/daily-entry?batch=morning')}
                    className="flex items-center justify-center gap-2 bg-orange-50 hover:bg-orange-100 text-orange-800 font-semibold py-3 px-4 rounded-2xl text-sm transition-colors"
                  >
                    <Sunrise size={18} />
                    <span>Morning Entry</span>
                  </button>
                  <button
                    onClick={() => navigate('/daily-entry?batch=evening')}
                    className="flex items-center justify-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold py-3 px-4 rounded-2xl text-sm transition-colors"
                  >
                    <Moon size={18} />
                    <span>Evening Entry</span>
                  </button>
                </div>
              </div>

              {/* Cattle Yield Quick Shortcut Card */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center text-2xl shrink-0">
                    🐄
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Cattle Inventory &amp; Daily Yield</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {milkingCount} cows/buffaloes milking • Today's farm yield: {cattleYield.total} L
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/cattle')}
                  className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0"
                >
                  <ClipboardList size={16} />
                  <span>View Cattle</span>
                </button>
              </div>
            </div>

            {/* Right Column: Monthly Revenue & Quick Actions (5 cols on laptop) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Monthly Revenue Card */}
              {billSummary && (
                <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">{monthName} Revenue</h2>
                    <button
                      onClick={() => navigate('/bills')}
                      className="text-xs font-semibold text-green-600 hover:text-green-700"
                    >
                      View All Bills ›
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-gray-50 rounded-2xl">
                      <div className="text-base sm:text-lg font-bold text-gray-900">
                        {formatCurrency(billSummary.expected)}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">Expected</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-2xl">
                      <div className="text-base sm:text-lg font-bold text-green-700">
                        {formatCurrency(billSummary.collected)}
                      </div>
                      <div className="text-[11px] text-green-600 mt-0.5">Collected</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-2xl">
                      <div className="text-base sm:text-lg font-bold text-red-600">
                        {formatCurrency(billSummary.pending)}
                      </div>
                      <div className="text-[11px] text-red-500 mt-0.5">Pending</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Management</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => navigate('/customers/add')}
                    className="flex items-center justify-center gap-2 p-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-semibold transition-colors shadow-xs"
                  >
                    <Plus size={18} />
                    <span>Add Customer</span>
                  </button>
                  <button
                    onClick={() => navigate('/bills')}
                    className="flex items-center justify-center gap-2 p-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl text-sm font-semibold transition-colors"
                  >
                    <IndianRupee size={18} />
                    <span>Monthly Bills</span>
                  </button>
                  <button
                    onClick={() => navigate('/cattle/add')}
                    className="flex items-center justify-center gap-2 p-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl text-sm font-semibold transition-colors"
                  >
                    <span>🐄</span>
                    <span>Add Animal</span>
                  </button>
                  <button
                    onClick={() => navigate('/daily-entry')}
                    className="flex items-center justify-center gap-2 p-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl text-sm font-semibold transition-colors"
                  >
                    <Milk size={18} />
                    <span>Daily Delivery</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
