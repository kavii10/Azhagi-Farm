import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Milk,
  Users,
  ReceiptText,
  ClipboardList,
  Settings,
  Menu,
  X,
  Plus,
  Sun,
  Moon,
  BarChart2,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useTheme } from '../lib/theme';
import { useSyncStatus } from '../lib/syncManager';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Daily overview & revenue' },
  { to: '/daily-entry', icon: Milk, label: 'Daily Entry', desc: 'Morning & evening delivery' },
  { to: '/customers', icon: Users, label: 'Customers', desc: 'Manage milk subscribers' },
  { to: '/bills', icon: ReceiptText, label: 'Monthly Bills', desc: 'Invoices, payments & overall statement' },
  { to: '/cattle', icon: ClipboardList, label: 'Cattle Inventory', desc: 'Cows, buffaloes & yield' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics', desc: 'Charts & farm insights' },
  { to: '/settings', icon: Settings, label: 'Settings', desc: 'Rates & farm preferences' },
];

const MOBILE_BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/daily-entry', icon: Milk, label: 'Daily Entry' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/bills', icon: ReceiptText, label: 'Bills' },
  { to: '/cattle', icon: ClipboardList, label: 'Cattle' },
];

const TAGLINE = 'Fresh from Our Farm to Your Family';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toggleTheme, isDark } = useTheme();
  const { status, queueCount, syncNow } = useSyncStatus();
  const navigate = useNavigate();
  const today = new Date();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200">
      {/* ============================================================ */}
      {/* UNIVERSAL TOP HEADER (Responsive for Laptop & Mobile) */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-2.5 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Hamburger menu toggle + Logo + Farm Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Navigation Menu"
              className="p-2 -ml-1.5 rounded-xl text-gray-700 dark:text-gray-200 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-gray-800 active:scale-95 transition-all focus:outline-none"
              title="Click to open menu"
            >
              <Menu size={24} strokeWidth={2.2} />
            </button>

            <div
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img
                src="/logo.png"
                alt="Azhagi Farm Milk"
                className="w-10 h-10 object-contain rounded-xl shadow-xs border border-green-100 dark:border-green-900/60 group-hover:scale-105 transition-transform shrink-0"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-700 dark:text-green-400 text-lg md:text-xl leading-tight">
                    Azhagi Farm
                  </span>
                  <span className="hidden sm:inline-block text-[10px] bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 font-bold px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800">
                    Milk
                  </span>
                </div>
                <span className="hidden md:block text-[11px] text-gray-400 dark:text-gray-400 leading-tight">
                  {TAGLINE}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Theme Toggle, Sync Status, Quick Actions & Live Date */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cloud Sync Status Pill */}
            <button
              type="button"
              onClick={() => syncNow()}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95',
                status === 'synced' &&
                  'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
                status === 'syncing' &&
                  'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse',
                status === 'pending' &&
                  'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                status === 'offline' &&
                  'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700'
              )}
              title={
                status === 'synced'
                  ? 'All records synced with Supabase cloud'
                  : status === 'syncing'
                  ? 'Syncing local records to cloud...'
                  : status === 'pending'
                  ? `${queueCount} changes waiting to sync. Click to sync now.`
                  : 'You are offline. Changes are saved locally and will auto-sync when online.'
              }
            >
              {status === 'synced' && <Cloud size={14} className="text-green-600 dark:text-green-400" />}
              {status === 'syncing' && <RefreshCw size={14} className="text-amber-600 animate-spin" />}
              {status === 'pending' && <RefreshCw size={14} className="text-amber-600" />}
              {status === 'offline' && <CloudOff size={14} className="text-gray-400" />}

              <span className="hidden md:inline text-[11px]">
                {status === 'synced' && 'Synced'}
                {status === 'syncing' && 'Syncing...'}
                {status === 'pending' && `Sync (${queueCount})`}
                {status === 'offline' && 'Offline'}
              </span>
            </button>

            {/* Theme Toggle Button (Sun / Moon) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700 active:scale-95"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun size={18} className="text-amber-400" />
              ) : (
                <Moon size={18} className="text-gray-700" />
              )}
            </button>

            {/* Live date badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span>📅</span>
              <span>{format(today, 'EEE, MMM d, yyyy')}</span>
            </div>

            {/* Quick action: Add customer */}
            <button
              onClick={() => navigate('/customers/add')}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-colors"
            >
              <Plus size={16} />
              <span className="hidden xs:inline">Add Customer</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* SLIDE-OUT SIDEBAR DRAWER (Opens only when clicking menu) */}
      {/* ============================================================ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Drawer Panel */}
          <aside className="relative w-80 max-w-[85vw] bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 border-r border-gray-100 dark:border-gray-800">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Azhagi Farm Milk"
                  className="w-11 h-11 object-contain rounded-xl shadow-xs border border-green-100 dark:border-green-900"
                />
                <div>
                  <div className="font-bold text-green-700 dark:text-green-400 text-base leading-tight">
                    Azhagi Farm
                  </div>
                  <div className="text-[10px] text-gray-400 italic line-clamp-1">{TAGLINE}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {NAV_ITEMS.map(({ to, icon: Icon, label, desc }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all',
                      isActive
                        ? 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 font-semibold border-l-4 border-green-600 shadow-xs'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-medium'
                    )
                  }
                >
                  <Icon size={22} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm leading-tight">{label}</div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 font-normal leading-tight mt-0.5">
                      {desc}
                    </div>
                  </div>
                </NavLink>
              ))}
            </nav>

            {/* Drawer Footer with Theme Toggle */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-300 font-medium">Azhagi Farm Milk</div>
                <div className="text-[10px] text-gray-400 italic mt-0.5">"{TAGLINE}"</div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ============================================================ */}
      {/* PAGE CONTENT CONTAINER (Responsive width for Laptop & Mobile) */}
      {/* ============================================================ */}
      <main className="flex-1 w-full pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* ============================================================ */}
      {/* MOBILE BOTTOM NAVIGATION BAR (Clean & Spacious 5-Tab Layout) */}
      {/* ============================================================ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex items-center justify-around py-1.5 px-2 pb-safe shadow-lg transition-colors">
        {MOBILE_BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center py-1 rounded-xl text-[11px] font-bold transition-all',
                isActive
                  ? 'text-green-600 dark:text-green-400 font-extrabold scale-105'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={21} strokeWidth={isActive ? 2.5 : 1.9} className="mb-0.5 shrink-0" />
                <span className="whitespace-nowrap tracking-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
