"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Account } from "@lms/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { CalendarDaysIcon, CommandIcon, ShieldIcon, UsersIcon } from "lucide-react";
import { buttonVariants } from "@lms/ui/button";
import { ThemeToggle } from "@lms/ui/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@lms/ui/sidebar";
import { TooltipProvider } from "@lms/ui/tooltip";
import { LogoutButton } from "#components/logout-button.tsx";

export const navigation = [
  {
    name: "My consultations",
    href: "/",
    icon: CalendarDaysIcon,
    roles: ["student", "teacher", "admin"],
  },
  { name: "Students", href: "/students", icon: UsersIcon, roles: ["teacher", "admin"] },
  { name: "Teachers", href: "/teachers", icon: UsersIcon, roles: ["student"] },
  { name: "Admin", href: "/admin", icon: ShieldIcon, roles: ["admin"] },
];

function SidebarLink({ onClick, ...props }: React.ComponentProps<typeof Link>) {
  const { setOpenMobile } = useSidebar();
  return (
    <Link
      prefetch
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpenMobile(false);
      }}
    />
  );
}

function SidebarNavigation({ account }: { account: Account }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <SidebarLink href="/" className="flex items-center gap-2 font-semibold">
            <CommandIcon className="size-5" /> Contour
          </SidebarLink>
          <ThemeToggle
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu aria-label="Main navigation">
              {navigation
                .filter((item) => item.roles.includes(account.role))
                .map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      render={
                        <SidebarLink
                          href={item.href}
                          aria-current={pathname === item.href ? "page" : undefined}
                        />
                      }
                    >
                      <item.icon />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 px-4 pb-5">
        <div className="flex flex-col gap-1 text-sm">
          <span className="truncate" title={account.email}>
            {account.email}
          </span>
          <span className="text-muted-foreground capitalize">{account.role}</span>
        </div>
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar({ children, account }: { children: ReactNode; account: Account }) {
  return (
    <TooltipProvider>
      <SidebarProvider
        className="h-dvh min-h-0 overflow-hidden"
        style={{ "--sidebar-width": "17rem" } as CSSProperties}
      >
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-semibold">Contour</span>
        </header>
        <SidebarNavigation account={account} />
        {children}
      </SidebarProvider>
    </TooltipProvider>
  );
}
