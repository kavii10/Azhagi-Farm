import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAppStore } from '../store/appStore';
import { createCustomer, updateCustomer, getCustomer, deleteCustomer } from '../lib/api';
import type { Customer, CustomerBatch } from '../types';
import { QUANTITY_OPTIONS } from '../types';
import ConfirmActionModal from '../components/ConfirmActionModal';

export default function AddCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings, addCustomer, updateCustomerInList, removeCustomer } = useAppStore();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    batch: 'morning' as CustomerBatch,
    default_quantity_litre: 1.0,
    default_quantity_evening_litre: 0.5,
    useCustomRate: false,
    custom_rate: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      getCustomer(id)
        .then((c) => {
          setForm({
            name: c.name,
            phone: c.phone || '',
            address: c.address || '',
            batch: c.batch,
            default_quantity_litre: c.default_quantity_litre || 1.0,
            default_quantity_evening_litre: c.default_quantity_evening_litre || 0.5,
            useCustomRate: !!c.custom_rate,
            custom_rate: c.custom_rate ? String(c.custom_rate) : '',
            notes: c.notes || '',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Customer name is required');
    if (!form.batch) return toast.error('Select a delivery batch');

    const payload: Omit<Customer, 'id' | 'owner_id' | 'created_at' | 'updated_at'> = {
      name: form.name.trim(),
      phone: form.phone || undefined,
      address: form.address || undefined,
      batch: form.batch,
      default_quantity_litre: form.default_quantity_litre,
      default_quantity_evening_litre: form.batch === 'both' ? form.default_quantity_evening_litre : undefined,
      custom_rate: form.useCustomRate && form.custom_rate ? parseFloat(form.custom_rate) : undefined,
      notes: form.notes || undefined,
      active: true,
    };

    setSaving(true);
    try {
      if (isEdit && id) {
        const updated = await updateCustomer(id, payload);
        updateCustomerInList(updated);
        toast.success('✓ Customer updated');
      } else {
        const created = await createCustomer(payload);
        addCustomer(created);
        toast.success('✓ Customer added');
      }
      navigate('/customers');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteCustomer = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteCustomer(id);
      removeCustomer(id);
      toast.success('✓ Customer deleted successfully');
      navigate('/customers');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete customer');
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Customer' : 'Add Customer'}
          </h1>
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 text-red-500 hover:text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={15} />
            Delete
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Customer Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Kumar"
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="9876543210"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="e.g. 12, Gandhi Street"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        {/* Delivery Batch */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Batch <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, batch: 'morning' }))}
              className={clsx(
                'py-3 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all',
                form.batch === 'morning'
                  ? 'border-orange-400 bg-orange-50 text-orange-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              🌅 Morning
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, batch: 'evening' }))}
              className={clsx(
                'py-3 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all',
                form.batch === 'evening'
                  ? 'border-purple-400 bg-purple-50 text-purple-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              🌙 Evening
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, batch: 'both' }))}
              className={clsx(
                'py-3 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all',
                form.batch === 'both'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              ☀️🌙 Both
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {form.batch === 'both'
              ? 'Customer gets milk in both morning and evening with separate quantities.'
              : form.batch === 'morning'
              ? 'Customer only receives delivery in the morning.'
              : 'Customer only receives delivery in the evening.'}
          </p>
        </div>

        {/* Default Quantity */}
        {form.batch === 'both' ? (
          <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div>
              <label className="block text-sm font-semibold text-orange-800 mb-2">
                🌅 Morning Default Quantity
              </label>
              <div className="grid grid-cols-4 gap-2">
                {QUANTITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, default_quantity_litre: opt.value }))}
                    className={clsx(
                      'py-2.5 rounded-xl text-sm font-bold border-2 transition-all bg-white',
                      form.default_quantity_litre === opt.value
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-700 hover:border-orange-300'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-purple-800 mb-2">
                🌙 Evening Default Quantity
              </label>
              <div className="grid grid-cols-4 gap-2">
                {QUANTITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, default_quantity_evening_litre: opt.value }))}
                    className={clsx(
                      'py-2.5 rounded-xl text-sm font-bold border-2 transition-all bg-white',
                      form.default_quantity_evening_litre === opt.value
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 text-gray-700 hover:border-purple-300'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Daily Quantity <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {QUANTITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, default_quantity_litre: opt.value }))}
                  className={clsx(
                    'py-3 rounded-xl text-sm font-bold border-2 transition-all',
                    form.default_quantity_litre === opt.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-green-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Milk Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Milk Rate</label>
          <div className="flex gap-3 mb-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, useCustomRate: false }))}
              className={clsx(
                'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                !form.useCustomRate
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-500'
              )}
            >
              Default ₹{settings?.default_rate || 60}/L
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, useCustomRate: true }))}
              className={clsx(
                'flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                form.useCustomRate
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-500'
              )}
            >
              Custom Rate
            </button>
          </div>
          {form.useCustomRate && (
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
              <input
                type="number"
                value={form.custom_rate}
                onChange={(e) => setForm((f) => ({ ...f, custom_rate: e.target.value }))}
                placeholder="e.g. 65"
                min="0"
                className="w-full pl-8 pr-16 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/ litre</span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Any special instructions..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || deleting}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60 shadow-sm"
        >
          {saving ? 'Saving...' : isEdit ? 'Update Customer' : 'Add Customer'}
        </button>
      </form>

      {/* Confirm Delete Modal */}
      <ConfirmActionModal
        isOpen={confirmDeleteOpen}
        title="Confirm Permanent Deletion"
        itemName={form.name}
        actionType="delete"
        message={`Are you sure you want to permanently delete "${form.name}"? All milk records, bills, and payment records for this customer will also be deleted.`}
        checkboxLabel="I understand that all customer data and history will be permanently deleted and cannot be recovered."
        confirmText="Permanently Delete Customer"
        onConfirm={executeDeleteCustomer}
        onClose={() => setConfirmDeleteOpen(false)}
        loading={deleting}
      />
    </div>
  );
}
