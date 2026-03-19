/**
 * Toast Notification System
 * OPTIMIZED: No race conditions, proper cleanup, accessibility
 */

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast {
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

export const useToastStore = create<ToastStore>((set, get) => ({
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
    useToastStore.getState().addToast({ type: 'success', title, message, duration }),

  error: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({
      type: 'error',
      title,
      message,
      duration: duration ?? 8000, // Errors stay longer
    }),

  warning: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'warning', title, message, duration }),

  info: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'info', title, message, duration }),

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

// ============================================================================
// ICONS & STYLES
// ============================================================================

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

// ============================================================================
// TOAST ITEM COMPONENT
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
  index: number;
}

function ToastItem({ toast, onRemove, index }: ToastItemProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(toast.duration);
  const isPausedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      onRemove(toast.id);
    }, remainingRef.current);
  }, [clearTimer, onRemove, toast.id]);

  // Start timer on mount
  useEffect(() => {
    startTimer();
    return () => clearTimer();
  }, [startTimer, clearTimer]);

  const handleMouseEnter = useCallback(() => {
    isPausedRef.current = true;
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    clearTimer();
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    isPausedRef.current = false;
    startTimeRef.current = Date.now();
    startTimer();
  }, [startTimer]);

  const handleClose = useCallback(() => {
    clearTimer();
    onRemove(toast.id);
  }, [clearTimer, onRemove, toast.id]);

  const Icon = icons[toast.type];
  const progress = 100;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9, x: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
        delay: index * 0.05,
      }}
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm min-w-[320px] max-w-[420px] shadow-lg cursor-pointer',
        styles[toast.type]
      )}
      role="alert"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        // Close on click (but not if clicking action button)
        if ((e.target as HTMLElement).closest('button[data-action]')) return;
        handleClose();
      }}
    >
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-white">{toast.title}</p>
        {toast.message && <p className="text-sm text-white/70 mt-1">{toast.message}</p>}
        {toast.action && (
          <button
            data-action
            onClick={(e) => {
              e.stopPropagation();
              toast.action?.onClick();
              handleClose();
            }}
            className="mt-2 text-sm font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4 text-white/50" />
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 rounded-b-xl"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{
          duration: toast.duration / 1000,
          ease: 'linear',
        }}
      />
    </motion.div>
  );
}

// ============================================================================
// TOAST CONTAINER
// ============================================================================

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast, index) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} index={index} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
