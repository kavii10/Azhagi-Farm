import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAnimal, saveAnimal, type AnimalType, type AnimalStatus } from '../lib/cattleStore';

const TYPE_OPTIONS: { value: AnimalType; label: string; emoji: string }[] = [
  { value: 'cow', label: 'Cow', emoji: '🐄' },
  { value: 'buffalo', label: 'Buffalo', emoji: '🐃' },
];

const STATUS_OPTIONS: { value: AnimalStatus; label: string; desc: string }[] = [
  { value: 'milking', label: '🟢 Milking', desc: 'Currently giving milk' },
  { value: 'dry', label: '🟡 Dry', desc: 'Not giving milk currently' },
  { value: 'calf', label: '🔵 Calf', desc: 'Young, not yet milking' },
  { value: 'sold', label: '⚫ Sold / Gone', desc: 'No longer in farm' },
];

export default function AddAnimalPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [name, setName] = useState('');
  const [type, setType] = useState<AnimalType>('cow');
  const [status, setStatus] = useState<AnimalStatus>('milking');
  const [tagNumber, setTagNumber] = useState('');
  const [dob, setDob] = useState('');
  const [purchasedDate, setPurchasedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      const animal = getAnimal(id);
      if (animal) {
        setName(animal.name);
        setType(animal.type);
        setStatus(animal.status);
        setTagNumber(animal.tag_number || '');
        setDob(animal.dob || '');
        setPurchasedDate(animal.purchased_date || '');
        setNotes(animal.notes || '');
      }
    }
  }, [id, isEdit]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter animal name');
      return;
    }
    setSaving(true);
    try {
      saveAnimal({
        id: isEdit ? id : undefined,
        name: name.trim(),
        type,
        status,
        tag_number: tagNumber.trim() || undefined,
        dob: dob || undefined,
        purchased_date: purchasedDate || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(isEdit ? '✓ Animal updated' : '✓ Animal added to inventory');
      navigate('/cattle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-8">
      {/* Back */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate('/cattle')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-medium"
        >
          <ArrowLeft size={18} />
          Cattle
        </button>
        <h1 className="text-base font-bold text-gray-900">
          {isEdit ? 'Edit Animal' : 'Add New Animal'}
        </h1>
        <div className="w-16" />
      </div>

      <div className="space-y-5">
        {/* Type selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Animal Type</label>
          <div className="grid grid-cols-2 gap-3">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  type === opt.value
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Animal Name <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kamadhenu, Lakshmi, Ganga..."
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Tag Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Tag / Ear Number <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={tagNumber}
            onChange={(e) => setTagNumber(e.target.value)}
            placeholder="e.g. TN-1234"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Milking Status</label>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-sm transition-all ${
                  status === opt.value
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="text-gray-400 text-xs">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Date of Birth <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Purchased On <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={purchasedDate}
              onChange={(e) => setPurchasedDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Healthy, gives good yield, recently vaccinated..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl hover:bg-green-700 disabled:opacity-60 shadow-sm text-sm"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : '+ Add to Inventory'}
        </button>
      </div>
    </div>
  </div>
);
}
