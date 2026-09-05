import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import type { Customer } from '../types';
import { formatQuantity } from '../types';

function CustomerCard({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md px-4 sm:px-5 py-3.5 flex items-center gap-3.5 text-left transition-all hover:border-green-200"
    >
      <div className="w-11 h-11 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
        <span className="text-green-800 font-bold text-base">{customer.name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900 text-base">{customer.name}</span>
          {customer.batch === 'both' && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Both Batches
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-1 leading-relaxed">
          {customer.batch === 'both' ? (
            <span>
              🌅 {formatQuantity(customer.default_quantity_litre)} • 🌙 {formatQuantity(customer.default_quantity_evening_litre || 0.5)}
            </span>
          ) : customer.batch === 'morning' ? (
            <span>🌅 Morning • Default: {formatQuantity(customer.default_quantity_litre)}</span>
          ) : (
            <span>🌙 Evening • Default: {formatQuantity(customer.default_quantity_litre)}</span>
          )}
          {customer.phone && ` • 📞 ${customer.phone}`}
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
    </button>
  );
}

export default function CustomersPage() {
  const { customers } = useAppStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'morning' | 'evening' | 'both'>('all');
  const [search, setSearch] = useState('');

  const searchFilter = (c: Customer) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search);

  const morning = customers.filter(
    (c) => (c.batch === 'morning' || c.batch === 'both') && searchFilter(c)
  );
  const evening = customers.filter(
    (c) => (c.batch === 'evening' || c.batch === 'both') && searchFilter(c)
  );
  const bothOnly = customers.filter(
    (c) => c.batch === 'both' && searchFilter(c)
  );
  const allFiltered = customers.filter(searchFilter);

  const displayed =
    tab === 'all'
      ? allFiltered
      : tab === 'morning'
      ? morning
      : tab === 'evening'
      ? evening
      : bothOnly;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{customers.length} total active subscribers</p>
        </div>
        <button
          onClick={() => navigate('/customers/add')}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-xs shrink-0"
        >
          <Plus size={18} />
          Add New Customer
        </button>
      </div>

      {/* Search & Tabs Toolbar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-xs mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer by name or phone number..."
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50/50 focus:bg-white transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('all')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all',
              tab === 'all'
                ? 'bg-green-600 text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            )}
          >
            All Customers ({customers.length})
          </button>
          <button
            onClick={() => setTab('morning')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all',
              tab === 'morning'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            )}
          >
            🌅 Morning ({customers.filter((c) => c.batch === 'morning' || c.batch === 'both').length})
          </button>
          <button
            onClick={() => setTab('evening')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all',
              tab === 'evening'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            )}
          >
            🌙 Evening ({customers.filter((c) => c.batch === 'evening' || c.batch === 'both').length})
          </button>
          <button
            onClick={() => setTab('both')}
            className={clsx(
              'px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all',
              tab === 'both'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            )}
          >
            ☀️🌙 Both ({customers.filter((c) => c.batch === 'both').length})
          </button>
        </div>
      </div>

      {/* Responsive Customer List / Grid */}
      {displayed.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-xs max-w-md mx-auto">
          <div className="text-5xl mb-3">👥</div>
          {search ? (
            <p className="text-gray-500 font-medium">No customers match "{search}"</p>
          ) : (
            <>
              <p className="font-bold text-gray-800 text-lg">No {tab} customers yet</p>
              <p className="text-sm text-gray-500 mt-1">Add your first customer to get started</p>
              <button
                onClick={() => navigate('/customers/add')}
                className="mt-5 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs"
              >
                + Add Customer
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayed.map((c) => (
            <CustomerCard key={c.id} customer={c} onClick={() => navigate(`/customers/${c.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
