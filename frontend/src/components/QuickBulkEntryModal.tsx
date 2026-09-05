import { useState, useEffect } from "react";
import { X, Search, Plus, Minus, Check, RotateCcw, AlertTriangle, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { Customer, Batch, MilkEntry } from "../types";
import { formatQuantity } from "../types";

interface QuickBulkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  batch: Batch;
  customers: Customer[];
  entries: Map<string, MilkEntry>;
  onSaveAll: (
    records: { customerId: string; qty: number; status: "delivered" | "no_milk" }[]
  ) => Promise<void>;
}

interface CustomerDraft {
  qty: number;
  status: "delivered" | "no_milk";
  defaultQty: number;
}

export default function QuickBulkEntryModal({
  isOpen,
  onClose,
  date,
  batch,
  customers,
  entries,
  onSaveAll,
}: QuickBulkEntryModalProps) {
  const [drafts, setDrafts] = useState<Record<string, CustomerDraft>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Initialize draft values for all customers when modal opens or batch/customers change
  useEffect(() => {
    if (!isOpen) return;

    const initial: Record<string, CustomerDraft> = {};
    for (const c of customers) {
      const defaultQty =
        batch === "evening" && c.batch === "both"
          ? c.default_quantity_evening_litre || 0.5
          : c.default_quantity_litre || 1.0;

      const existing = entries.get(`${c.id}:${batch}`);
      if (existing) {
        initial[c.id] = {
          qty: existing.status === "no_milk" ? 0 : existing.quantity_litre || defaultQty,
          status: existing.status,
          defaultQty,
        };
      } else {
        // Pre-fill with default buying milk value!
        initial[c.id] = {
          qty: defaultQty,
          status: "delivered",
          defaultQty,
        };
      }
    }
    setDrafts(initial);
  }, [isOpen, customers, batch, entries]);

  if (!isOpen) return null;

  const handleStep = (customerId: string, delta: number) => {
    setDrafts((prev) => {
      const current = prev[customerId];
      if (!current) return prev;

      const newQty = Math.max(0, parseFloat((current.qty + delta).toFixed(2)));
      return {
        ...prev,
        [customerId]: {
          ...current,
          qty: newQty,
          status: newQty <= 0 ? "no_milk" : "delivered",
        },
      };
    });
  };

  const handleSetExact = (customerId: string, qty: number, status: "delivered" | "no_milk" = "delivered") => {
    setDrafts((prev) => {
      const current = prev[customerId];
      if (!current) return prev;
      return {
        ...prev,
        [customerId]: {
          ...current,
          qty,
          status: qty <= 0 ? "no_milk" : status,
        },
      };
    });
  };

  const handleResetToDefaults = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id in next) {
        next[id] = {
          ...next[id],
          qty: next[id].defaultQty,
          status: "delivered",
        };
      }
      return next;
    });
  };

  const handleSetAllNoMilk = () => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id in next) {
        next[id] = {
          ...next[id],
          qty: 0,
          status: "no_milk",
        };
      }
      return next;
    });
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)
  );

  const totalLitres = Object.values(drafts)
    .filter((d) => d.status === "delivered")
    .reduce((sum, d) => sum + d.qty, 0);

  const deliveredCount = Object.values(drafts).filter((d) => d.status === "delivered" && d.qty > 0).length;
  const noMilkCount = Object.values(drafts).filter((d) => d.status === "no_milk" || d.qty === 0).length;

  const handleApplyAll = async () => {
    setSaving(true);
    try {
      const records = Object.entries(drafts).map(([customerId, draft]) => ({
        customerId,
        qty: draft.status === "delivered" ? draft.qty : 0,
        status: draft.status,
      }));
      await onSaveAll(records);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 bg-white dark:bg-gray-900 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                <Sparkles size={18} />
              </span>
              <h2 className="font-extrabold text-gray-900 dark:text-white text-lg sm:text-xl">
                Quick Bulk Entry
              </h2>
              <span
                className={clsx(
                  "text-xs font-bold px-2.5 py-0.5 rounded-full capitalize",
                  batch === "morning"
                    ? "bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400"
                    : "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400"
                )}
              >
                {batch === "morning" ? "🌅 Morning Session" : "🌙 Evening Session"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Date: <strong className="text-gray-800 dark:text-gray-200">{date}</strong> • Pre-filled with default buying values. Adjust with <strong>+</strong> and <strong>-</strong> then apply all at once!
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Global Toolbar */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950/60 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter customer name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400 font-medium"
            />
          </div>

          {/* Bulk Shortcuts */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-gray-700 shadow-2xs transition-colors"
            >
              <RotateCcw size={12} />
              Reset All Defaults
            </button>
            <button
              type="button"
              onClick={handleSetAllNoMilk}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-gray-700 shadow-2xs transition-colors"
            >
              <AlertTriangle size={12} />
              All No Milk
            </button>
          </div>
        </div>

        {/* Customer Rows List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 px-3 sm:px-5 py-2">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">No matching customers found</div>
          ) : (
            filteredCustomers.map((c, index) => {
              const draft = drafts[c.id] || {
                qty: c.default_quantity_litre || 1.0,
                status: "delivered",
                defaultQty: c.default_quantity_litre || 1.0,
              };

              const isModified =
                draft.status === "no_milk"
                  ? draft.defaultQty > 0
                  : Math.abs(draft.qty - draft.defaultQty) > 0.001;

              return (
                <div
                  key={c.id}
                  className="py-3 px-2 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Customer Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-400 w-5">
                        {index + 1}.
                      </span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                        {c.name}
                      </span>
                      {c.batch === "both" && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded">
                          Both
                        </span>
                      )}
                      {isModified && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded">
                          Modified
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-400 ml-7 mt-0.5">
                      Default: <strong className="text-gray-700 dark:text-gray-200">{formatQuantity(draft.defaultQty)}</strong>
                    </div>
                  </div>

                  {/* Quantity Stepper & Quick Pills */}
                  <div className="flex items-center gap-2 sm:gap-3 ml-7 sm:ml-0 flex-wrap sm:flex-nowrap">
                    {/* Stepper with - and + */}
                    <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleStep(c.id, -0.25)}
                        className="p-2 sm:p-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                        title="Decrease 0.25 L"
                      >
                        <Minus size={15} strokeWidth={2.5} />
                      </button>

                      {/* Display Box */}
                      <div className="px-3 min-w-[75px] sm:min-w-[85px] text-center">
                        {draft.status === "no_milk" || draft.qty <= 0 ? (
                          <span className="text-xs font-bold text-red-500">🚫 No Milk</span>
                        ) : (
                          <span className="text-sm font-extrabold text-green-600 dark:text-green-400">
                            {draft.qty.toFixed(2)} L
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStep(c.id, 0.25)}
                        className="p-2 sm:p-2.5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
                        title="Increase 0.25 L"
                      >
                        <Plus size={15} strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSetExact(c.id, draft.defaultQty, "delivered")}
                        title="Reset to default quantity"
                        className={clsx(
                          "px-2 py-1 rounded-lg text-xs font-bold transition-colors border",
                          draft.status === "delivered" && Math.abs(draft.qty - draft.defaultQty) < 0.01
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100"
                        )}
                      >
                        Def
                      </button>
                      {[0.5, 1.0, 1.5, 2.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleSetExact(c.id, val, "delivered")}
                          className={clsx(
                            "px-1.5 sm:px-2 py-1 rounded-lg text-xs font-bold transition-colors border",
                            draft.status === "delivered" && Math.abs(draft.qty - val) < 0.01
                              ? "bg-green-600 text-white border-green-600"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleSetExact(c.id, 0, "no_milk")}
                        title="No Milk today"
                        className={clsx(
                          "px-1.5 py-1 rounded-lg text-xs font-bold transition-colors border",
                          draft.status === "no_milk"
                            ? "bg-red-600 text-white border-red-600"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-red-50 hover:text-red-500"
                        )}
                      >
                        🚫
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Summary & Apply All Button */}
        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Total Milk to Deliver</div>
              <div className="text-xl sm:text-2xl font-black text-green-700 dark:text-green-400">
                {totalLitres.toFixed(2)} Litres
              </div>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <div>
                <strong className="text-gray-900 dark:text-white font-bold">{deliveredCount}</strong> delivering
              </div>
              <div>
                <strong className="text-red-500 font-bold">{noMilkCount}</strong> no milk
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyAll}
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Check size={18} strokeWidth={2.5} />
              <span>{saving ? "Applying Entries..." : `Apply & Save for All (${totalLitres.toFixed(2)} L)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
