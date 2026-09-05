import { create } from 'zustand';
import type { Customer, AppSettings } from '../types';
import { getCustomers, getSettings, upsertSettings } from '../lib/api';

interface AppState {
  customers: Customer[];
  settings: AppSettings | null;
  loading: boolean;

  // Actions
  loadCustomers: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (s: Partial<AppSettings>) => Promise<void>;
  addCustomer: (c: Customer) => void;
  updateCustomerInList: (c: Customer) => void;
  removeCustomer: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  customers: [],
  settings: null,
  loading: false,

  loadCustomers: async () => {
    try {
      const customers = await getCustomers();
      set({ customers });
    } catch (e) {
      console.error(e);
    }
  },

  loadSettings: async () => {
    try {
      const settings = await getSettings();
      set({ settings });
    } catch (e) {
      console.error(e);
    }
  },

  updateSettings: async (updates) => {
    const updated = await upsertSettings(updates);
    set({ settings: updated });
  },

  addCustomer: (c) =>
    set((state) => ({ customers: [...state.customers, c].sort((a, b) => a.name.localeCompare(b.name)) })),

  updateCustomerInList: (c) =>
    set((state) => ({
      customers: state.customers.map((x) => (x.id === c.id ? c : x)),
    })),

  removeCustomer: (id) =>
    set((state) => ({ customers: state.customers.filter((c) => c.id !== id) })),
}));
