"use client";

import * as React from "react";
import { ConfirmDialog } from "./confirm-dialog";

/* Promise-based replacement for window.confirm, rendered as a Vibe modal.
   `const confirmAction = useConfirm()` →
   `if (!(await confirmAction("Delete this form?"))) return;` */

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (message: React.ReactNode, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

interface PendingConfirm {
  message: React.ReactNode;
  options: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback<ConfirmFn>((message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, options, resolve });
    });
  }, []);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialog
          open
          title={pending.options.title ?? "Are you sure?"}
          message={pending.message}
          confirmText={pending.options.confirmText ?? "Confirm"}
          cancelText={pending.options.cancelText ?? "Cancel"}
          destructive={pending.options.destructive ?? true}
          onConfirm={() => settle(true)}
          onClose={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
