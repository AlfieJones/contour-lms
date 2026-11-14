"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarInset } from "@lms/ui/sidebar";
import { AppSidebar, navigation } from "#components/app-sidebar.tsx";
import type { Account } from "@lms/api";

export function AppShell({ children, account }: { children: ReactNode; account: Account }) {
  const pathname = usePathname();
  const title = navigation.find((item) => item.href === pathname)?.name ?? "Contour";

  return (
    <AppSidebar account={account}>
      <SidebarInset
        aria-label={title}
        className="min-h-0 min-w-0 overflow-hidden max-md:pt-14 md:rounded-2xl md:border md:shadow-none"
      >
        <div key={pathname} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </SidebarInset>
    </AppSidebar>
  );
}
