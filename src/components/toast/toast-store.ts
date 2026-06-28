// Lightweight, framework-agnostic toast store.
//
// Exposes an imperative `notify(...)` that can be called from anywhere —
// React components, hooks, or plain helper modules — as a drop-in replacement
// for the browser's `alert()`. A single <ToastViewport /> mounted at the app
// root subscribes to this store and renders the toasts.

export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(toasts));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

// Best-effort tone detection so existing `alert("...")` calls — which only pass
// a string — still get a sensible colour/icon without touching every call site.
function inferType(message: string): ToastType {
  const text = message.toLowerCase();
  if (/(fail|error|invalid|denied|unable|cannot|can.t|wrong|not found|خطأ|فشل)/.test(text)) {
    return "error";
  }
  if (/(network|try again|please |required|must |select |enter |تأكد|الرجاء|من فضل)/.test(text)) {
    return "warning";
  }
  if (/(success|sent|saved|added|created|updated|deleted|removed|done|✓|تم|نجاح|بنجاح)/.test(text)) {
    return "success";
  }
  return "info";
}

// Drop-in replacement for `alert()`. Returns void so it can be used inline
// (e.g. `return notify("...")`) exactly like the call it replaces.
export function notify(message: string, type?: ToastType): void {
  const id = ++counter;
  toasts = [...toasts, { id, message, type: type ?? inferType(message) }];
  emit();
}
