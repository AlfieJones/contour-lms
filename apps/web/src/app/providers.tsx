"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AnchoredToastProvider, ToastProvider } from "@lms/ui/toast";

import { getQueryClient } from "#lib/query-client.ts";

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider attribute="class">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AnchoredToastProvider>{children}</AnchoredToastProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
