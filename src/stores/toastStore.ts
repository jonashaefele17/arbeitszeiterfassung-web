import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = 'success') => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, tone }] });
    window.setTimeout(() => get().dismiss(id), tone === 'error' ? 4500 : 2200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
