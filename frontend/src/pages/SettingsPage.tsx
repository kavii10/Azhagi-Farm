import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/appStore';

const TAGLINE = 'Fresh from Our Farm to Your Family';

export default function SettingsPage() {
  const { settings, updateSettings } = useAppStore();
  const [farmName, setFarmName] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFarmName(settings.farm_name || 'Azhagi Farm');
      setDefaultRate(String(settings.default_rate || 60));
    }
  }, [settings]);

  const handleSave = async () => {
    const rate = parseFloat(defaultRate);
    if (isNaN(rate) || rate < 0) return toast.error('Enter a valid rate');
    if (!farmName.trim()) return toast.error('Farm name is required');
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
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Farm Settings</h1>

      {/* Farm Branding Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <img
            src="/logo.png"
            alt="Azhagi Farm Milk"
            className="w-16 h-16 object-contain rounded-2xl border border-green-100 shadow-xs shrink-0"
          />
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 text-base">{farmName || 'Azhagi Farm'}</h2>
            <p className="text-xs text-green-700 font-medium italic">{TAGLINE}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Brand Logo Active &amp; Verified</p>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1.5">Farm Name</label>
        <input
          type="text"
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
          placeholder="Azhagi Farm"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Milk Rate (₹ per litre)</label>
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
          <input
            type="number"
            value={defaultRate}
            onChange={(e) => setDefaultRate(e.target.value)}
            placeholder="60"
            min="0"
            className="w-full pl-8 pr-16 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/ litre</span>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-700">
          ⚠ Changing the default rate will only affect future bills. Existing finalized bills are preserved.
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 w-full justify-center bg-green-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 shadow-sm"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* About Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3 text-sm">About Azhagi Farm App</h2>
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.png"
            alt="Azhagi Farm Milk"
            className="w-12 h-12 object-contain rounded-xl border border-green-100 shrink-0"
          />
          <div>
            <div className="font-bold text-green-700 text-sm">Azhagi Farm Milk</div>
            <div className="text-xs text-gray-500 italic">{TAGLINE}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Version 2.0 • Real-time Milk Management</div>
          </div>
        </div>
      </div>
    </div>
  );
}
