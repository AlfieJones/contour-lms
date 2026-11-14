import type { ReactNode } from "react";
import { AppShell } from "#components/app-shell.tsx";
import { requireAccount } from "#lib/account.server.ts";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const account = await requireAccount();
  return <AppShell account={account}>{children}</AppShell>;
}
