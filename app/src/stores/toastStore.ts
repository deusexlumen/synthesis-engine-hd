/**
 * Toast Notification Store & Helpers
 * OPTIMIZED: No race conditions, proper cleanup, accessibility
 */

import { create } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  createdAt: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toastData) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: Toast = {
      ...toastData,
      id,
      createdAt: Date.now(),
      duration: toastData.duration ?? 5000,
    };

    set((state) => ({
      toasts: [...state.toasts.slice(-4), newToast], // Keep max 5 toasts
    }));

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  clearAll: () => set({ toasts: [] }),
}));

// ============================================================================
// TOAST HELPERS
// ============================================================================

export const toast = {
  success: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'success', title, message, duration: duration ?? 5000 }),

  error: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({
      type: 'error',
      title,
      message,
      duration: duration ?? 8000, // Errors stay longer
    }),

  warning: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'warning', title, message, duration: duration ?? 5000 }),

  info: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'info', title, message, duration: duration ?? 5000 }),

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    },
    duration?: number
  ): Promise<T> => {
    const id = useToastStore.getState().addToast({
      type: 'info',
      title: messages.loading,
      duration: 60000, // Long duration for loading
    });

    return promise
      .then((result) => {
        useToastStore.getState().removeToast(id);
        useToastStore.getState().addToast({
          type: 'success',
          title: messages.success,
          duration: duration ?? 5000,
        });
        return result;
      })
      .catch((error) => {
        useToastStore.getState().removeToast(id);
        useToastStore.getState().addToast({
          type: 'error',
          title: messages.error,
          message: error instanceof Error ? error.message : undefined,
          duration: 8000,
        });
        throw error;
      });
  },

  dismiss: (id: string) => useToastStore.getState().removeToast(id),

  clearAll: () => useToastStore.getState().clearAll(),
};
