"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";
import { ToastProvider } from "@/components/ui/toaster";
import { ConfirmProvider } from "@/components/ui/confirm-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
