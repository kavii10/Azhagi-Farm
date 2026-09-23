import { create } from 'zustand';

const PIN_STORAGE_KEY = 'azhagi_app_security_pin';
const DEFAULT_INITIAL_PIN = '1A2B';

export interface LockState {
  isUnlocked: boolean;
  pin: string;
  isPinModalOpen: boolean;
  modalTitle: string;
  pendingAction: (() => void) | null;

  // Actions
  unlock: (enteredPin: string) => boolean;
  lock: () => void;
  requestUnlock: (action?: () => void, title?: string) => void;
  closePinModal: () => void;
  changePin: (oldPin: string, newPin: string) => { success: boolean; message: string };
}

function getStoredPin(): string {
  try {
    const saved = localStorage.getItem(PIN_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    console.warn('[LockStore] Failed to read PIN from localStorage:', e);
  }
  return DEFAULT_INITIAL_PIN;
}

export const useLockStore = create<LockState>((set, get) => ({
  isUnlocked: false, // Default to locked on app launch / refresh
  pin: getStoredPin(),
  isPinModalOpen: false,
  modalTitle: 'Enter PIN to Edit Data',
  pendingAction: null,

  unlock: (enteredPin: string) => {
    const { pin, pendingAction } = get();
    // Normalize both for case-insensitive comparison to make mobile input easy
    const isMatch = enteredPin.trim().toUpperCase() === pin.trim().toUpperCase();

    if (isMatch) {
      set({
        isUnlocked: true,
        isPinModalOpen: false,
        pendingAction: null,
      });

      if (pendingAction) {
        try {
          pendingAction();
        } catch (err) {
          console.error('[LockStore] Error executing pending action:', err);
        }
      }
      return true;
    }
    return false;
  },

  lock: () => {
    set({
      isUnlocked: false,
      isPinModalOpen: false,
      pendingAction: null,
    });
  },

  requestUnlock: (action?: () => void, title = 'Enter PIN to Edit Data') => {
    const { isUnlocked } = get();
    if (isUnlocked) {
      // Already unlocked, run action immediately
      if (action) action();
    } else {
      // Open PIN modal and save action to execute after unlocking
      set({
        isPinModalOpen: true,
        modalTitle: title,
        pendingAction: action || null,
      });
    }
  },

  closePinModal: () => {
    set({
      isPinModalOpen: false,
      pendingAction: null,
    });
  },

  changePin: (oldPin: string, newPin: string) => {
    const { pin } = get();
    if (oldPin.trim().toUpperCase() !== pin.trim().toUpperCase()) {
      return { success: false, message: 'Incorrect old password.' };
    }

    const trimmedNew = newPin.trim();
    if (trimmedNew.length < 3) {
      return { success: false, message: 'New password must be at least 3 characters long.' };
    }

    try {
      localStorage.setItem(PIN_STORAGE_KEY, trimmedNew);
      set({ pin: trimmedNew });
      return { success: true, message: 'Password updated successfully!' };
    } catch (e: any) {
      return { success: false, message: `Failed to save password: ${e.message}` };
    }
  },
}));
