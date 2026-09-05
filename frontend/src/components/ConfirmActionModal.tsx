import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  itemName?: string;
  actionType?: 'delete' | 'deactivate';
  message?: string;
  checkboxLabel?: string;
  confirmText?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export default function ConfirmActionModal({
  isOpen,
  title,
  itemName,
  actionType = 'delete',
  message,
  checkboxLabel,
  confirmText,
  onConfirm,
  onClose,
  loading = false,
}: ConfirmActionModalProps) {
  const [confirmedTick, setConfirmedTick] = useState(false);

  // Reset tick state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setConfirmedTick(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDelete = actionType === 'delete';
  const defaultMessage = isDelete
    ? `You are about to permanently delete "${itemName || 'this item'}". All related records, entries, and history will be completely erased.`
    : `You are about to deactivate "${itemName || 'this item'}". It will be hidden from daily entry lists.`;

  const defaultCheckboxLabel = isDelete
    ? 'I understand that this action is permanent and cannot be undone. I want to delete this data.'
    : 'I understand and confirm that I want to deactivate this item.';

  const defaultConfirmButtonText = isDelete ? 'Permanently Delete' : 'Confirm Deactivation';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Warning Icon */}
        <div className="flex items-center gap-3.5 mb-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isDelete
                ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900'
            }`}
          >
            {isDelete ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
              {title}
            </h3>
            {itemName && (
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Item: {itemName}
              </span>
            )}
          </div>
        </div>

        {/* Warning Description */}
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed mb-5 ${
            isDelete
              ? 'bg-red-50/80 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900/50'
              : 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50'
          }`}
        >
          <p className="font-medium">{message || defaultMessage}</p>
        </div>

        {/* Compulsory Confirmation Checkbox */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 mb-6">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmedTick}
              onChange={(e) => setConfirmedTick(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
            />
            <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 leading-snug">
              {checkboxLabel || defaultCheckboxLabel}
            </span>
          </label>
          {!confirmedTick && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 italic pl-7">
              * Please tick the box above to enable the action button.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmedTick || loading}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all shadow-xs ${
              !confirmedTick || loading
                ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400 shadow-none'
                : isDelete
                ? 'bg-red-600 hover:bg-red-700 active:scale-98 shadow-red-500/25'
                : 'bg-amber-600 hover:bg-amber-700 active:scale-98 shadow-amber-500/25'
            }`}
          >
            {loading ? 'Processing...' : confirmText || defaultConfirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
