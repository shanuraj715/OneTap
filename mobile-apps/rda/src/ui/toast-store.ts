import { createStore } from "zustand/vanilla";

export type ToastTone = "ok" | "info" | "warn" | "danger";
export interface Toast { id: number; message: string; tone: ToastTone; durationMs: number }

/** Errors stay a little longer: they need reading, a "Saved" does not. */
export const DEFAULT_DURATION: Record<ToastTone, number> = { ok: 3000, info: 3500, warn: 5000, danger: 6000 };
/** More than this at once is noise; the oldest goes first. */
export const MAX_TOASTS = 3;

export function createToastStore() {
  let nextId = 1;
  const store = createStore<{ toasts: Toast[] }>(() => ({ toasts: [] }));
  const dismiss = (id: number) => store.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  const show = (message: string, tone: ToastTone = "info", durationMs?: number): number => {
    const state = store.getState();
    // the same message twice in a row (a double tap) shows once
    const dup = state.toasts.find((t) => t.message === message && t.tone === tone);
    if (dup) return dup.id;
    const id = nextId++;
    const toast: Toast = { id, message, tone, durationMs: durationMs ?? DEFAULT_DURATION[tone] };
    store.setState({ toasts: [...state.toasts, toast].slice(-MAX_TOASTS) });
    return id;
  };
  return { store, show, dismiss, clear: () => store.setState({ toasts: [] }), ok: (m: string) => show(m, "ok"), info: (m: string) => show(m, "info"), warn: (m: string) => show(m, "warn"), error: (m: string) => show(m, "danger") };
}

/** The one app-wide toast store. */
export const toasts = createToastStore();
