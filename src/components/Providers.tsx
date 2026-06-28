"use client";
import { SessionProvider } from "next-auth/react";
import { ToastViewport } from "@/components/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <ToastViewport />
    </SessionProvider>
  );
}
