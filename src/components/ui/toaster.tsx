"use client";

import * as React from "react";
import { Toast } from "@vibe/core";

/* App-wide toast notifications backed by Vibe Toast.
   Wrap the app in <ToastProvider> (done in components/providers.tsx) and
   call `const { toast } = useToast()` → `toast("Saved", "positive")`. */

export type ToastVariant = "normal" | "positive" | "negative" | "warning";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(1);

  const toast = React.useCallback(
    (message: string, variant: ToastVariant = "normal") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    []
  );

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-[10000] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            open
            type={t.variant}
            autoHideDuration={5000}
            onClose={() => dismiss(t.id)}
          >
            {t.message}
          </Toast>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
