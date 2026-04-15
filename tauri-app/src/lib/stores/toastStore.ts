import { writable } from 'svelte/store';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
}

function createToastStore() {
  const { subscribe, update } = writable<ToastState>({ toasts: [] });

  return {
    subscribe,

    show(message: string, type: ToastItem['type'] = 'info', duration = 3000) {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      update(state => ({
        toasts: [...state.toasts, { id, message, type, duration }],
      }));
      if (duration > 0) {
        setTimeout(() => {
          update(state => ({
            toasts: state.toasts.filter(t => t.id !== id),
          }));
        }, duration);
      }
      return id;
    },

    dismiss(id: string) {
      update(state => ({
        toasts: state.toasts.filter(t => t.id !== id),
      }));
    },

    success(message: string, duration?: number) {
      return this.show(message, 'success', duration);
    },

    error(message: string, duration?: number) {
      return this.show(message, 'error', duration);
    },

    warning(message: string, duration?: number) {
      return this.show(message, 'warning', duration);
    },

    info(message: string, duration?: number) {
      return this.show(message, 'info', duration);
    },

    addToast(toast: Omit<ToastItem, 'id'>) {
      return this.show(toast.message, toast.type, toast.duration);
    },
  };
}

export const toastStore = createToastStore();
