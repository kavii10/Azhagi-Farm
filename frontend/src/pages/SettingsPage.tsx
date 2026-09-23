import { useState, useEffect } from 'react';
import { Save, Lock, Unlock, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { useLockStore } from '../store/lockStore';

const TAGLINE = 'Fresh from Our Farm to Your Family';

export default function SettingsPage() {
  const { settings, updateSettings } = useAppStore();
  const { isUnlocked, lock, requestUnlock, changePin } = useLockStore();

  // Farm Settings State
  const [farmName, setFarmName] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [saving, setSaving] = useState(false);

  // Security / Password Change State
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingPin, setUpdatingPin] = useState(false);

  useEffect(() => {
    if (settings) {
      setFarmName(
        settings.farm_name &&
          settings.farm_name !== 'Azhagi Farm' &&
          settings.farm_name !== 'Azhagi Farm Milk'
          ? settings.farm_name
          : 'AZHAGI NATURA'
      );
      setDefaultRate(String(settings.default_rate || 60));
    }
  }, [settings]);

  const handleSave = () => {
    const rate = parseFloat(defaultRate);
    if (isNaN(rate) || rate < 0) return toast.error('Enter a valid rate');
    if (!farmName.trim()) return toast.error('Farm name is required');

    requestUnlock(async () => {
      setSaving(true);
      try {
        await updateSettings({
          farm_name: farmName.trim(),
          default_rate: rate,
        });
        toast.success('✓ Settings saved');
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setSaving(false);
      }
    }, 'Enter Password to Save Farm Settings');
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPin.trim()) {
      return toast.error('Please enter your current password');
    }
    if (!newPin.trim()) {
      return toast.error('Please enter a new password');
    }
    if (newPin.trim().length < 3) {
      return toast.error('New password must have at least 3 characters');
    }
    if (newPin.trim() !== confirmPin.trim()) {
      return toast.error('New passwords do not match');
    }

    setUpdatingPin(true);
    try {
      const res = changePin(oldPin, newPin);
      if (res.success) {
        toast.success(`✓ ${res.message}`);
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        toast.error(res.message);
      }
    } finally {
      setUpdatingPin(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-6">
        App &amp; Farm Settings
      </h1>

      {/* ============================================================ */}
      {/* 1. App Security & Password Lock Card (User's Anti-Mistouch Protection) */}
      {/* ============================================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} strokeWidth={2.3} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Edit Lock &amp; Password Protection</span>
                <span
                  className={clsx(
                    'text-[11px] font-bold px-2 py-0.5 rounded-full',
                    isUnlocked
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                  )}
                >
                  {isUnlocked ? '🔓 Edit Mode' : '🔒 Protected'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Protects milk entries and customer data from accidental touches.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isUnlocked) {
                lock();
                toast.success('🔒 Locked! Data is now protected from accidental edits.');
              } else {
                requestUnlock(undefined, 'Enter Password to Edit Data');
              }
            }}
            className={clsx(
              'px-3.5 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5',
              isUnlocked
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-xs'
            )}
          >
            {isUnlocked ? (
              <>
                <Lock size={14} />
                <span>Re-Lock Editing Now</span>
              </>
            ) : (
              <>
                <Unlock size={14} />
                <span>Unlock Editing</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-3.5 mb-5 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold mb-0.5">💡 How it works:</p>
          <p>
            When someone opens the app, data is visible for browsing, but <strong>modifying any entry</strong> requires entering your password. Initial password is <strong>1A2B</strong> (letters &amp; numbers allowed). You can update it below at any time.
          </p>
        </div>

        {/* Change Password Form */}
        <form onSubmit={handleUpdatePassword} className="space-y-3.5">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <KeyRound size={16} className="text-gray-400" />
            <span>Change App Password</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="e.g. 1A2B"
                  className="w-full pl-3 pr-9 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Letters &amp; Numbers"
                  className="w-full pl-3 pr-9 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full pl-3 pr-9 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={updatingPin}
              className="px-4 py-2 bg-gray-900 hover:bg-black dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-60 shadow-xs"
            >
              {updatingPin ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* ============================================================ */}
      {/* 2. Farm Branding & Milk Rate Card */}
      {/* ============================================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
          <img
            src="/logo.png"
            alt="AZHAGI NATURA"
            className="w-16 h-16 object-contain rounded-2xl border border-green-100 dark:border-green-900/60 shadow-xs shrink-0"
          />
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white text-base">
              {farmName || 'AZHAGI NATURA'}
            </h2>
            <p className="text-xs text-green-700 dark:text-green-400 font-medium italic">{TAGLINE}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Brand Logo Active &amp; Verified</p>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Farm Name
        </label>
        <input
          type="text"
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
          placeholder="AZHAGI NATURA"
          className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-white"
        />

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Default Milk Rate (₹ per litre)
        </label>
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
          <input
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="60"
            min="0"
            className="w-full pl-8 pr-16 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-white"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/ litre</span>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 rounded-xl p-3 mb-4 text-xs text-amber-700 dark:text-amber-300">
          ⚠ Changing the default rate will only affect future bills. Existing finalized bills are preserved.
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 w-full justify-center bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 shadow-sm transition-all active:scale-98"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* ============================================================ */}
      {/* 3. About Section */}
      {/* ============================================================ */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 sm:p-6">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 text-sm">
          About App
        </h2>
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.png"
            alt="AZHAGI NATURA"
            className="w-12 h-12 object-contain rounded-xl border border-green-100 dark:border-green-900/60 shrink-0"
          />
          <div>
            <div className="font-bold text-green-700 dark:text-green-400 text-sm">
              AZHAGI NATURA
            </div>
            <div className="text-xs text-gray-500 italic">{TAGLINE}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Version 2.0 • Real-time Milk Management &amp; Anti-Mistouch Security
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
