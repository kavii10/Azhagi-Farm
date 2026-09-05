import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Milk,
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  getAnimals,
  getTodayFarmYield,
  getAllMonthlyYield,
  getAllYieldsForDate,
  upsertDailyYield,
  syncCattleWithCloud,
  type Animal,
  type AnimalStatus,
  type DailyYield,
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

const ANIMAL_EMOJI: Record<string, string> = {
  cow: '🐄',
  buffalo: '🐃',
};

// ---- Quick Yield Entry Modal for Selected Date ----
function QuickYieldModal({
  animal,
  date,
  existingYield,
  onClose,
  onSaved,
}: {
  animal: Animal;
  date: string;
  existingYield?: DailyYield;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [morning, setMorning] = useState(existingYield?.morning_litres || 0);
  const [evening, setEvening] = useState(existingYield?.evening_litres || 0);
  const [saving, setSaving] = useState(false);

  const QUICK = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8];

  const handleSave = () => {
    setSaving(true);
    try {
      upsertDailyYield({
        animal_id: animal.id,
        date,
        morning_litres: morning,
        evening_litres: evening,
      });
      toast.success(`✓ Recorded yield for ${animal.name}`);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-5 sm:p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{ANIMAL_EMOJI[animal.type]}</span>
            <div>
              <h3 className="font-bold text-gray-900 text-base">{animal.name}</h3>
              <p className="text-xs text-gray-500">
                Yield for <strong>{format(new Date(date + 'T00:00:00'), 'EEE, MMM d, yyyy')}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        {/* Morning yield */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-orange-700 uppercase tracking-wide mb-1.5">
            🌅 Morning Yield (Litres)
          </label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setMorning(q)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
                  morning === q
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-orange-300'
                )}
              >
                {q === 0 ? '0' : `${q}L`}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            max={30}
            step={0.25}
            value={morning === 0 ? '' : morning}
            onChange={(e) => setMorning(parseFloat(e.target.value) || 0)}
            placeholder="0.0 L"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Evening yield */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-purple-700 uppercase tracking-wide mb-1.5">
            🌙 Evening Yield (Litres)
          </label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setEvening(q)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
                  evening === q
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-purple-300'
                )}
              >
                {q === 0 ? '0' : `${q}L`}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            max={30}
            step={0.25}
            value={evening === 0 ? '' : evening}
            onChange={(e) => setEvening(parseFloat(e.target.value) || 0)}
            placeholder="0.0 L"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl mb-4 text-sm font-semibold">
          <span className="text-gray-600">Day's Total:</span>
          <span className="text-green-700 text-base">{(morning + evening).toFixed(2)} Litres</span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm shadow-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save Cattle Yield'}
        </button>
      </div>
    </div>
  );
}

export default function CattlePage() {
  const navigate = useNavigate();

  // Date selection state for calendar / previous days
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [dateYield, setDateYield] = useState({ morning: 0, evening: 0, total: 0 });
  const [monthlyYield, setMonthlyYield] = useState(0);
  const [dailyYields, setDailyYields] = useState<DailyYield[]>([]);
  const [editModal, setEditModal] = useState<{ animal: Animal; existing?: DailyYield } | null>(null);

  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const isToday = selectedDate === todayStr;
  const year = selectedDateObj.getFullYear();
  const month = selectedDateObj.getMonth() + 1;

  const load = () => {
    setAnimals(getAnimals());
    setDateYield(getTodayFarmYield(selectedDate));
    setDailyYields(getAllYieldsForDate(selectedDate));
    setMonthlyYield(getAllMonthlyYield(year, month));
  };

  useEffect(() => {
    load();
    syncCattleWithCloud().then(() => load());
  }, [selectedDate]);

  const handlePrevDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  const activeAnimals = animals.filter((a) => a.status !== 'sold');
  const milkingAnimals = animals.filter((a) => a.status === 'milking');
  const cowCount = animals.filter((a) => a.type === 'cow' && a.status !== 'sold').length;
  const buffaloCount = animals.filter((a) => a.type === 'buffalo' && a.status !== 'sold').length;

  const yieldMap = new Map<string, DailyYield>();
  dailyYields.forEach((y) => yieldMap.set(y.animal_id, y));

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
            🐄 Cattle Inventory &amp; Milk Yield
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track individual cow &amp; buffalo yield, milking status, and daily farm production
          </p>
        </div>
        <button
          onClick={() => navigate('/cattle/add')}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors shrink-0"
        >
          <Plus size={18} />
          Add New Animal
        </button>
      </div>

      {/* ============================================================ */}
      {/* CALENDAR & DATE NAVIGATOR (Supports Backfilling Any Date) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handlePrevDay}
            className="flex items-center gap-1 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors"
          >
            <ChevronLeft size={16} />
            <span className="hidden xs:inline">Prev Day</span>
          </button>

          <div className="text-center flex flex-col items-center">
            <div className="flex items-center justify-center gap-2">
              <span className="font-bold text-gray-900 text-base sm:text-lg">
                {format(selectedDateObj, 'EEEE, MMMM d, yyyy')}
              </span>
              {isToday ? (
                <span className="bg-green-100 text-green-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Today
                </span>
              ) : (
                <button
                  onClick={handleSetToday}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded-full transition-colors"
                >
                  <RotateCcw size={11} />
                  Jump to Today
                </button>
              )}
            </div>

            {/* Quick date picker input */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-gray-400">Jump to Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="text-xs text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-400 font-medium"
              />
            </div>
          </div>

          <button
            onClick={handleNextDay}
            className="flex items-center gap-1 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors"
          >
            <span className="hidden xs:inline">Next Day</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {!isToday && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center text-xs font-medium text-amber-700 bg-amber-50/70 py-1.5 px-3 rounded-xl">
            📅 Currently viewing/backfilling yield records for {format(selectedDateObj, 'MMM d, yyyy')}.
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SUMMARY STATS GRID (Responsive: 2 on mobile, 4 on laptop) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{activeAnimals.length}</div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 mt-1">Total Animals</div>
          <div className="text-xs text-gray-400 dark:text-gray-300 mt-1 font-medium">
            🐄 {cowCount} Cows &nbsp;|&nbsp; 🐃 {buffaloCount} Buffaloes
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="text-2xl sm:text-3xl font-extrabold text-green-700 dark:text-green-400">{milkingAnimals.length}</div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 mt-1">Currently Milking</div>
          <div className="text-xs text-gray-400 dark:text-gray-300 mt-1 font-medium">
            {animals.filter((a) => a.status === 'dry').length} Dry &nbsp;|&nbsp;
            {animals.filter((a) => a.status === 'calf').length} Calves
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-400">{dateYield.total} L</div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 mt-1">
            Yield on {format(selectedDateObj, 'MMM d')}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-300 mt-1 font-medium">
            🌅 {dateYield.morning} L &nbsp;|&nbsp; 🌙 {dateYield.evening} L
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-700 dark:text-purple-400">{monthlyYield} L</div>
          <div className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 mt-1">
            {format(selectedDateObj, 'MMMM yyyy')} Total
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-300 mt-1 font-medium">Full farm production</div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ANIMAL CARDS GRID (Responsive: 1 on mobile, 2/3 on laptop) */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base sm:text-lg font-bold text-gray-800">
            Animals ({animals.length})
          </h2>
          <span className="text-xs text-gray-400">
            Tap animal card to view full history or record yield
          </span>
        </div>

        {animals.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center max-w-md mx-auto">
            <div className="text-5xl mb-3">🐄</div>
            <h3 className="font-bold text-gray-800 text-lg">No Animals Added Yet</h3>
            <p className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto">
              Start tracking your dairy cattle by adding your cows and buffaloes with their milking status.
            </p>
            <button
              onClick={() => navigate('/cattle/add')}
              className="mt-5 inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-colors"
            >
              <Plus size={16} />
              Add First Animal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {animals.map((animal) => {
              const yEntry = yieldMap.get(animal.id);
              const hasRecorded = Boolean(yEntry && (yEntry.morning_litres > 0 || yEntry.evening_litres > 0));

              return (
                <div
                  key={animal.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-xs hover:shadow-md transition-shadow p-4 sm:p-5 flex flex-col justify-between"
                >
                  {/* Animal Info */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl sm:text-4xl p-2 bg-gray-50 rounded-2xl shrink-0">
                          {ANIMAL_EMOJI[animal.type]}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 text-base sm:text-lg">
                              {animal.name}
                            </span>
                            {animal.tag_number && (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                                #{animal.tag_number}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 capitalize mt-0.5">
                            {animal.type === 'cow' ? 'Cow' : 'Buffalo'}
                            {animal.dob && ` • Born ${format(new Date(animal.dob + 'T00:00:00'), 'MMM yyyy')}`}
                          </div>
                        </div>
                      </div>

                      <span
                        className={clsx(
                          'text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0',
                          STATUS_COLORS[animal.status]
                        )}
                      >
                        {STATUS_LABELS[animal.status]}
                      </span>
                    </div>

                    {/* Selected Date Yield Status */}
                    {animal.status === 'milking' && (
                      <div className="bg-gray-50 dark:bg-gray-900/90 rounded-xl p-3 my-3 text-xs border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
                          <span>Yield on {format(selectedDateObj, 'MMM d')}:</span>
                          <span className={clsx('font-bold', hasRecorded ? 'text-gray-900 dark:text-white' : 'text-amber-600 dark:text-amber-400')}>
                            {hasRecorded
                              ? `${((yEntry?.morning_litres || 0) + (yEntry?.evening_litres || 0)).toFixed(2)} L`
                              : 'Not Recorded'}
                          </span>
                        </div>
                        {hasRecorded && (
                          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300 font-medium">
                            <span>🌅 {yEntry?.morning_litres} L</span>
                            <span>🌙 {yEntry?.evening_litres} L</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-2">
                    {animal.status === 'milking' && (
                      <button
                        type="button"
                        onClick={() => setEditModal({ animal, existing: yEntry })}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold py-2 px-3 rounded-xl transition-colors"
                      >
                        <Milk size={14} />
                        {hasRecorded ? 'Edit Yield' : '+ Record Yield'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/cattle/${animal.id}`)}
                      className="inline-flex items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold py-2 px-3 rounded-xl transition-colors"
                    >
                      <span>Profile</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Yield Entry Modal */}
      {editModal && (
        <QuickYieldModal
          animal={editModal.animal}
          date={selectedDate}
          existingYield={editModal.existing}
          onClose={() => setEditModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
