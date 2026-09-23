import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, X, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLockStore } from '../store/lockStore';

export default function PinModal() {
  const { isPinModalOpen, modalTitle, unlock, closePinModal } = useLockStore();
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPinModalOpen) {
      setPinInput('');
      setShowPassword(false);
      setErrorShake(false);
      // Auto-focus input after render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isPinModalOpen]);

  if (!isPinModalOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!pinInput.trim()) {
      setErrorShake(true);
      setTimeout(() => setErrorShake(false), 500);
      return;
    }

    const success = unlock(pinInput);
    if (success) {
      toast.success('🔓 Editing unlocked!', { id: 'pin-unlock-toast' });
    } else {
      setErrorShake(true);
      toast.error('Incorrect password. Please try again.', { id: 'pin-error-toast' });
      setTimeout(() => setErrorShake(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transform transition-transform ${
          errorShake ? 'animate-bounce' : ''
        }`}
      >
        {/* Header */}
        <div className="p-5 pb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-xs">
              <Lock size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Security Verification
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {modalTitle || 'Enter password to edit data'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePinModal}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 pt-2">
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 bg-gray-50 dark:bg-gray-750 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700">
            🛡️ <strong>Protection Active:</strong> Prevents accidental touches or mistouches from changing milk records.
          </p>

          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Enter PIN / Password (Letters &amp; Numbers)
          </label>
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <KeyRound size={17} />
            </div>
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter password..."
              className="w-full pl-10 pr-11 py-3 text-sm font-mono tracking-wider bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white shadow-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={closePinModal}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-98 text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Lock size={14} />
              <span>Unlock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
