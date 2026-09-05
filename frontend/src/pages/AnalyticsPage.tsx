import { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from "recharts";
import { TrendingUp, Milk, IndianRupee, Users, ArrowUpRight, ArrowDownRight, BarChart2 } from "lucide-react";
import { getAnalyticsData, type MonthlyAnalytics } from "../lib/api";
import { getAllMonthlyYield } from "../lib/cattleStore";
import { formatCurrency } from "../types";

const COLORS = {
  green: "#22c55e",
  emerald: "#10b981",
  blue: "#3b82f6",
  orange: "#f97316",
  red: "#ef4444",
  purple: "#a855f7",
  teal: "#14b8a6",
  amber: "#f59e0b",
};

function KpiCard({
  label,
  value,
  sub,
  icon,
  color = "green",
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color?: keyof typeof COLORS;
  trend?: "up" | "down" | "neutral";
}) {
  const bg: Record<string, string> = {
    green: "bg-green-50 text-green-600 border-green-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    red: "bg-red-50 text-red-600 border-red-100",
    teal: "bg-teal-50 text-teal-600 border-teal-100",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`p-2.5 rounded-xl border ${bg[color]}`}>{icon}</div>
        {trend === "up" && <ArrowUpRight size={16} className="text-green-500" />}
        {trend === "down" && <ArrowDownRight size={16} className="text-red-500" />}
      </div>
      <div>
        <div className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">{value}</div>
        <div className="text-sm font-medium text-gray-500 mt-1">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-3 text-xs">
      <div className="font-bold text-gray-800 mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-900">
            {typeof p.value === "number"
              ? p.name.includes("₹") || p.name.toLowerCase().includes("revenue") || p.name.toLowerCase().includes("billed") || p.name.toLowerCase().includes("collected") || p.name.toLowerCase().includes("pending") || p.name.toLowerCase().includes("amount")
                ? formatCurrency(p.value)
                : `${p.value.toFixed(2)} L`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyAnalytics[]>([]);
  const [ytdRevenue, setYtdRevenue] = useState(0);
  const [ytdLitres, setYtdLitres] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [topCustomers, setTopCustomers] = useState<{ name: string; litres: number; amount: number }[]>([]);
  const [cattleMonthly, setCattleMonthly] = useState<{ label: string; yield: number; sold: number }[]>([]);

  useEffect(() => {
    setLoading(true);
    getAnalyticsData(selectedYear).then((data) => {
      setMonthly(data.monthly);
      setYtdRevenue(data.ytdRevenue);
      setYtdLitres(data.ytdLitres);
      setCollectionRate(data.collectionRate);
      setTotalOutstanding(data.totalOutstanding);
      setTopCustomers(data.topCustomers);

      // Cattle yield data for the year
      const cattleData = data.monthly.map((m) => ({
        label: m.label,
        yield: getAllMonthlyYield(selectedYear, m.month),
        sold: m.totalLitres,
      }));
      setCattleMonthly(cattleData);
      setLoading(false);
    });
  }, [selectedYear]);

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const bestMonth = monthly.reduce(
    (best, m) => (m.totalCollected > best.totalCollected ? m : best),
    monthly[0] || { label: "—", totalCollected: 0 }
  );

  const avgDaily =
    monthly.filter((m) => m.totalLitres > 0).length > 0
      ? parseFloat(
          (
            ytdLitres /
            monthly.filter((m) => m.totalLitres > 0).reduce((s, m) => {
              const days = new Date(m.year, m.month, 0).getDate();
              return s + days;
            }, 0)
          ).toFixed(2)
        )
      : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
            <BarChart2 size={28} className="text-green-600" />
            Farm Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Production, Revenue &amp; Customer Insights</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          label="Total Revenue (YTD)"
          value={formatCurrency(ytdRevenue)}
          sub={`${selectedYear} collected`}
          icon={<IndianRupee size={20} />}
          color="green"
          trend="up"
        />
        <KpiCard
          label="Total Milk Sold (YTD)"
          value={`${ytdLitres.toFixed(1)} L`}
          sub={`Avg ${avgDaily} L/day`}
          icon={<Milk size={20} />}
          color="blue"
          trend="up"
        />
        <KpiCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          sub="Billed amount collected"
          icon={<TrendingUp size={20} />}
          color={collectionRate >= 80 ? "green" : collectionRate >= 50 ? "orange" : "red"}
          trend={collectionRate >= 80 ? "up" : "down"}
        />
        <KpiCard
          label="Outstanding Balance"
          value={formatCurrency(totalOutstanding)}
          sub="Pending payment"
          icon={<IndianRupee size={20} />}
          color="red"
          trend={totalOutstanding > 0 ? "down" : "neutral"}
        />
      </div>

      {/* ─── Secondary KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-sm">
          <div className="text-xs font-semibold opacity-80 mb-1">Best Month</div>
          <div className="text-2xl font-extrabold">{bestMonth.label || "—"}</div>
          <div className="text-sm opacity-90 mt-1">{formatCurrency(bestMonth.totalCollected)} collected</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-sm">
          <div className="text-xs font-semibold opacity-80 mb-1">Total Milk Billed</div>
          <div className="text-2xl font-extrabold">
            {formatCurrency(monthly.reduce((s, m) => s + m.totalBilled, 0))}
          </div>
          <div className="text-sm opacity-90 mt-1">
            {monthly.reduce((s, m) => s + m.totalLitres, 0).toFixed(1)} L across {selectedYear}
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-5 text-white shadow-sm">
          <div className="text-xs font-semibold opacity-80 mb-1">Avg Daily Sales</div>
          <div className="text-2xl font-extrabold">{avgDaily} L/day</div>
          <div className="text-sm opacity-90 mt-1">Average across active months</div>
        </div>
      </div>

      {/* ─── Monthly Milk Production ─── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Milk size={18} className="text-blue-500" />
          Monthly Milk Sold (Litres)
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" L" width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="totalLitres" name="Milk Sold (L)" radius={[6, 6, 0, 0]}>
              {monthly.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.totalLitres > 0 ? COLORS.blue : "#e5e7eb"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Revenue: Billed vs Collected vs Pending ─── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <IndianRupee size={18} className="text-green-600" />
          Revenue — Billed vs Collected vs Pending
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} width={65}
              tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="totalBilled" name="Billed" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
            <Bar dataKey="totalCollected" name="Collected" fill={COLORS.green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="totalPending" name="Pending" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Cattle Yield vs Customer Sales ─── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
        <h2 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
          <span className="text-xl">🐄</span>
          Cattle Yield vs Customer Sales
        </h2>
        <p className="text-xs text-gray-400 mb-4">Farm production vs milk delivered to customers</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={cattleMonthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit=" L" width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="yield" name="Farm Yield (L)" stroke={COLORS.teal} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="sold" name="Customer Sales (L)" stroke={COLORS.blue} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Revenue Area Chart ─── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-purple-500" />
          Revenue Trend (Collected)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} width={65}
              tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="totalCollected"
              name="Collected"
              stroke={COLORS.green}
              strokeWidth={2.5}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Bottom Row: Top Customers + Customer Count ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            Top Customers (This Month)
          </h2>
          {topCustomers.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">No data for this month yet</div>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, i) => {
                const max = topCustomers[0].litres;
                const pct = max > 0 ? (c.litres / max) * 100 : 0;
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                        <span className="inline-flex w-5 h-5 bg-orange-100 text-orange-700 font-bold rounded-full items-center justify-center text-[10px]">{i + 1}</span>
                        {c.name}
                      </span>
                      <span className="text-gray-500 font-medium">{c.litres.toFixed(2)} L · {formatCurrency(c.amount)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly Customer Count */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users size={18} className="text-purple-500" />
            Active Billing Customers per Month
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} width={35} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="customerCount" name="Customers" fill={COLORS.purple} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Profit Estimate ─── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
        <h2 className="text-base font-bold text-gray-900 mb-4">Monthly Summary Table</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 text-gray-500 font-semibold">Month</th>
                <th className="text-right pb-2 text-gray-500 font-semibold">Milk (L)</th>
                <th className="text-right pb-2 text-gray-500 font-semibold">Billed</th>
                <th className="text-right pb-2 text-gray-500 font-semibold">Collected</th>
                <th className="text-right pb-2 text-gray-500 font-semibold">Pending</th>
                <th className="text-right pb-2 text-gray-500 font-semibold">Customers</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2 font-semibold text-gray-800">{m.label} {m.year}</td>
                  <td className="py-2 text-right text-gray-700">{m.totalLitres > 0 ? m.totalLitres.toFixed(2) : "—"}</td>
                  <td className="py-2 text-right text-gray-700">{m.totalBilled > 0 ? formatCurrency(m.totalBilled) : "—"}</td>
                  <td className="py-2 text-right text-green-700 font-semibold">{m.totalCollected > 0 ? formatCurrency(m.totalCollected) : "—"}</td>
                  <td className={`py-2 text-right font-semibold ${m.totalPending > 0 ? "text-amber-600" : "text-gray-400"}`}>
                    {m.totalPending > 0 ? formatCurrency(m.totalPending) : "—"}
                  </td>
                  <td className="py-2 text-right text-gray-600">{m.customerCount > 0 ? m.customerCount : "—"}</td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-gray-200 font-bold text-gray-900">
                <td className="pt-3">TOTAL</td>
                <td className="pt-3 text-right">{ytdLitres.toFixed(2)} L</td>
                <td className="pt-3 text-right">{formatCurrency(monthly.reduce((s, m) => s + m.totalBilled, 0))}</td>
                <td className="pt-3 text-right text-green-700">{formatCurrency(ytdRevenue)}</td>
                <td className="pt-3 text-right text-amber-600">{totalOutstanding > 0 ? formatCurrency(totalOutstanding) : "—"}</td>
                <td className="pt-3 text-right">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}



