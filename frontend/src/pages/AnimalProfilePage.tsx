import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import ConfirmActionModal from '../components/ConfirmActionModal';
import {
  getAnimal,
  deleteAnimal,
  getYieldsForAnimal,
  upsertDailyYield,
  getMonthlyYieldForAnimal,
  type Animal,
  type DailyYield,
  type AnimalStatus,
} from '../lib/cattleStore';

const STATUS_COLORS: Record<AnimalStatus, string> = {
  milking: 'bg-green-100 text-green-700',
  dry: 'bg-amber-100 text-amber-700',
  calf: 'bg-blue-100 text-blue-700',
  sold: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<AnimalStatus, string> = {
  milking: '🟢 Milking',
  dry: '🟡 Dry',
  calf: '🔵 Calf',
  sold: '⚫ Sold',
};

// ---- Quick yield input component ----
function YieldInput({
  label,
  value,
  onChange,
  color = 'green',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: 'orange' | 'purple' | 'green';
}) {
  const QUICK = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8];
  return (
    <div>
      <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">{label}</div>
      <div className="flex gap-1.5 flex-wrap">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={clsx(
              'px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all',
              value === q
                ? color === 'orange'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : color === 'purple'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            )}
          >
            {q === 0 ? '—' : `${q}L`}
          </button>
        ))}
      </div>
      <input
        type="number"
        min={0}
        max={30}
        step={0.25}
        value={value === 0 ? '' : value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder="0.0 L"
        className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    </div>
  );
}

export default function AnimalProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [yields, setYields] = useState<DailyYield[]>([]);
  const [monthStats, setMonthStats] = useState({ totalMorning: 0, totalEvening: 0, totalLitres: 0 });

  // Yield entry state (supports picking any date)
  const [entryDate, setEntryDate] = useState(todayStr);
  const [morningYield, setMorningYield] = useState(0);
  const [eveningYield, setEveningYield] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    if (!id) return;
    const a = getAnimal(id);
    if (!a) return;
    setAnimal(a);
    const y = getYieldsForAnimal(id, viewYear, viewMonth);
    setYields(y);
    setMonthStats(getMonthlyYieldForAnimal(id, viewYear, viewMonth));

    // Load entry for selected date
    const dateEntry = y.find((e) => e.date === entryDate);
    if (dateEntry) {
      setMorningYield(dateEntry.morning_litres);
      setEveningYield(dateEntry.evening_litres);
    } else {
      setMorningYield(0);
      setEveningYield(0);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, viewYear, viewMonth, entryDate]);

  const handleSaveYield = () => {
    if (!id) return;
    setSaving(true);
    try {
      upsertDailyYield({
        animal_id: id,
        date: entryDate,
        morning_litres: morningYield,
        evening_litres: eveningYield,
      });
      toast.success(`✓ Yield saved for ${format(new Date(entryDate + 'T00:00:00'), 'MMM d')}`);
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handlePrevDay = () => {
    const parts = entryDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    setEntryDate(format(d, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const parts = entryDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    setEntryDate(format(d, 'yyyy-MM-dd'));
  };

  const executeDeleteAnimal = () => {
    if (!animal) return;
    setDeleteLoading(true);
    try {
      deleteAnimal(animal.id);
      toast.success(`✓ ${animal.name} removed from inventory`);
      navigate('/cattle');
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteOpen(false);
    }
  };

  if (!animal) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Animal not found</p>
      </div>
    );
  }

  // Build yield map
  const yieldMap = new Map<string, DailyYield>();
  yields.forEach((y) => yieldMap.set(y.date, y));

  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth - 1));
  const monthName = format(new Date(viewYear, viewMonth - 1), 'MMMM yyyy');
  const animalEmoji = animal.type === 'cow' ? '🐄' : '🐃';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back + Edit */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate('/cattle')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-medium"
        >
          <ArrowLeft size={18} />
          <span>Cattle Inventory</span>
        </button>
        <button
          onClick={() => navigate(`/cattle/${animal.id}/edit`)}
          className="flex items-center gap-1.5 text-green-600 hover:text-green-700 text-sm font-semibold"
        >
          <Edit2 size={16} />
          <span>Edit Animal</span>
        </button>
      </div>

      {/* 2-Column Responsive Layout on Laptop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Card, Yield Entry, Delete (5 cols on laptop) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Animal Profile Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-4xl shrink-0 border border-green-100">
                {animalEmoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{animal.name}</h2>
                  {animal.tag_number && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                      #{animal.tag_number}
                    </span>
                  )}
                  <span
                    className={clsx(
                      'text-xs font-semibold px-2.5 py-0.5 rounded-full',
                      STATUS_COLORS[animal.status]
                    )}
                  >
                    {STATUS_LABELS[animal.status]}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1 capitalize">
                  {animal.type === 'cow' ? '🐄 Cow' : '🐃 Buffalo'}
                  {animal.dob && ` • Born ${format(new Date(animal.dob + 'T00:00:00'), 'MMMM yyyy')}`}
                </div>
                {animal.purchased_date && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Purchased: {format(new Date(animal.purchased_date + 'T00:00:00'), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            </div>
            {animal.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-xs text-amber-800">
                📝 {animal.notes}
              </div>
            )}
          </div>

          {/* Record / Backfill Yield Entry */}
          {animal.status === 'milking' && (
            <div className="bg-white rounded-3xl border border-green-100 shadow-xs p-5 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900 text-base">Record Milk Yield</h3>
                <span className="text-xs text-green-700 bg-green-50 font-semibold px-2.5 py-0.5 rounded-full">
                  Yield Entry
                </span>
              </div>

              {/* Date selector for backfill */}
              <div className="mb-4 bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors shadow-2xs"
                >
                  ‹ Prev
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-600">Date:</span>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => e.target.value && setEntryDate(e.target.value)}
                    className="text-xs text-gray-800 font-semibold border border-gray-200 rounded-lg px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleNextDay}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors shadow-2xs"
                >
                  Next ›
                </button>
              </div>

              <div className="space-y-4">
                <YieldInput
                  label="🌅 Morning Yield"
                  value={morningYield}
                  onChange={setMorningYield}
                  color="orange"
                />
                <YieldInput
                  label="🌙 Evening Yield"
                  value={eveningYield}
                  onChange={setEveningYield}
                  color="purple"
                />
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="text-sm text-gray-600 font-medium">
                  Total: <strong className="text-gray-900 font-bold text-base">{(morningYield + eveningYield).toFixed(2)} L</strong>
                </div>
                <button
                  onClick={handleSaveYield}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 shadow-xs transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Yield'}
                </button>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-white rounded-3xl border border-red-100 shadow-xs p-5">
            <h3 className="text-sm font-bold text-red-700 mb-2">Animal Actions</h3>
            <p className="text-xs text-gray-400 mb-3">Permanently remove this animal from farm records.</p>
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 px-4 border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors w-full"
            >
              <Trash2 size={15} />
              <span>Permanently Delete {animal.name}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Month Navigator, Yield Summary & Daily Log (7 cols on laptop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Month Navigator */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-xs px-5 py-3.5">
            <button
              onClick={() => {
                if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
                else setViewMonth(m => m - 1);
              }}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-bold text-gray-900 text-base sm:text-lg">{monthName}</span>
            <button
              onClick={() => {
                if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
                else setViewMonth(m => m + 1);
              }}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Monthly Summary */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6">
            <h3 className="font-bold text-gray-900 text-base mb-4">{monthName} Yield Summary</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-orange-50 rounded-2xl p-3.5 text-center">
                <div className="text-xl font-extrabold text-orange-700">{monthStats.totalMorning} L</div>
                <div className="text-xs text-orange-600 font-medium mt-0.5">🌅 Morning</div>
              </div>
              <div className="bg-purple-50 rounded-2xl p-3.5 text-center">
                <div className="text-xl font-extrabold text-purple-700">{monthStats.totalEvening} L</div>
                <div className="text-xs text-purple-600 font-medium mt-0.5">🌙 Evening</div>
              </div>
              <div className="bg-green-50 rounded-2xl p-3.5 text-center">
                <div className="text-xl font-extrabold text-green-700">{monthStats.totalLitres} L</div>
                <div className="text-xs text-green-600 font-medium mt-0.5">Total Yield</div>
              </div>
            </div>

            {/* Daily breakdown */}
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Daily Yield Log</h4>
            <div className="space-y-1">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const entry = yieldMap.get(dateStr);
                const isCurrent = dateStr === todayStr;
                const isFuture = new Date(dateStr + 'T00:00:00') > now;

                return (
                  <div
                    key={dateStr}
                    onClick={() => {
                      if (!isFuture) {
                        setEntryDate(dateStr);
                      }
                    }}
                    className={clsx(
                      'flex items-center justify-between py-2 px-3 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer',
                      isCurrent && 'bg-green-50/80 font-semibold',
                      !entry && !isFuture && 'opacity-60 hover:bg-gray-50',
                      entry && 'hover:bg-gray-50'
                    )}
                  >
                    <span
                      className={clsx(
                        'text-gray-500 w-28 flex-shrink-0',
                        isCurrent && 'text-green-700 font-bold'
                      )}
                    >
                      {format(new Date(dateStr + 'T00:00:00'), 'dd MMM (EEE)')}
                    </span>
                    {isFuture ? (
                      <span className="text-gray-300">—</span>
                    ) : !entry ? (
                      <span className="text-gray-400 text-xs italic">Tap to enter yield</span>
                    ) : (
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600">
                          🌅 <strong className="text-gray-900">{entry.morning_litres}L</strong>
                        </span>
                        <span className="text-gray-600">
                          🌙 <strong className="text-gray-900">{entry.evening_litres}L</strong>
                        </span>
                        <span className="font-bold text-green-800">
                          = {(entry.morning_litres + entry.evening_litres).toFixed(2)}L
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmActionModal
        isOpen={confirmDeleteOpen}
        title="Confirm Permanent Deletion"
        itemName={animal?.name}
        actionType="delete"
        message={`Are you sure you want to permanently delete "${animal?.name}" and all its milk yield records? This action cannot be undone.`}
        checkboxLabel="I understand that all yield data for this animal will be permanently erased and cannot be recovered."
        confirmText="Permanently Delete Animal"
        onConfirm={executeDeleteAnimal}
        onClose={() => setConfirmDeleteOpen(false)}
        loading={deleteLoading}
      />
    </div>
  );
}
