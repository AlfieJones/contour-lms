"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Account } from "@lms/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDaysIcon,
  Clock3Icon,
  CommandIcon,
  UserRoundIcon,
  UsersIcon,
  ChevronsUpDownIcon,
  LogInIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@lms/ui/avatar";
import { Button, buttonVariants } from "@lms/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@lms/ui/menu";
import { ThemeToggle } from "@lms/ui/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@lms/ui/sidebar";
import { TooltipProvider } from "@lms/ui/tooltip";
import { orpc } from "#lib/orpc.ts";

export function AppShell({ children, account }: { children: ReactNode; account: Account }) {
  const pathname = usePathname();
  const title = navigation.find((item) => item.href === pathname)?.name ?? "Contour";

  return (
    <TooltipProvider>
      <SidebarProvider
        className="h-dvh min-h-0 overflow-hidden"
        style={{ "--sidebar-width": "17rem" } as CSSProperties}
      >
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="font-semibold">Contour</span>
          </div>
          <div className="flex items-center gap-1">
            <AppThemeToggle />
            <UserMenu compact />
          </div>
        </header>
        <SidebarNavigation account={account} />
        <SidebarInset
          aria-label={title}
          className="min-h-0 min-w-0 overflow-hidden max-md:pt-14 md:rounded-2xl md:border md:shadow-none"
        >
          <div key={pathname} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function AppThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <ThemeToggle
      className={buttonVariants({ variant: "ghost", size: "icon" })}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    />
  );
}

const mainNavigation = [
  {
    name: "My consultations",
    href: "/",
    icon: CalendarDaysIcon,
    roles: ["student", "teacher", "admin"],
  },
  { name: "Students", href: "/students", icon: UsersIcon, roles: ["teacher", "admin"] },
  { name: "Teachers", href: "/teachers", icon: UsersIcon, roles: ["student"] },
];

const adminNavigation = [
  { name: "Users", href: "/admin/users", icon: UsersIcon, roles: ["admin"] },
  {
    name: "Consultations",
    href: "/admin/consultations",
    icon: CalendarDaysIcon,
    roles: ["admin"],
  },
];

const settingsNavigation = [
  {
    name: "Account",
    href: "/settings",
    icon: UserRoundIcon,
    roles: ["student", "teacher", "admin"],
  },
  {
    name: "Availability",
    href: "/settings/availability",
    icon: Clock3Icon,
    roles: ["teacher", "admin"],
  },
];

const navigationGroups = [
  { label: null, ariaLabel: "Main navigation", items: mainNavigation },
  { label: "Settings", ariaLabel: "Settings navigation", items: settingsNavigation },
  { label: "Admin", ariaLabel: "Admin navigation", items: adminNavigation },
];

const navigation = [...mainNavigation, ...adminNavigation, ...settingsNavigation];

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
  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <SidebarLink href="/" className="flex items-center gap-2 font-semibold">
            <CommandIcon className="size-5" /> Contour
          </SidebarLink>
          <AppThemeToggle />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navigationGroups.map((group) => {
          const items = group.items.filter((item) => item.roles.includes(account.role));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.ariaLabel}>
              {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu aria-label={group.ariaLabel}>
                  {items.map((item) => (
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
          );
        })}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-5">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { setOpenMobile } = useSidebar();
  const account = useQuery(orpc.user.get.queryOptions({ retry: false }));
  const logout = useMutation(
    orpc.user.logout.mutationOptions({
      onSuccess: () => {
        // Reload to discard cached account data and refresh server-rendered content.
        window.location.assign("/");
      },
    }),
  );
  const user = account.data;
  const avatarUrl = user?.avatarUrl;
  const name = user?.name || user?.email || "Account";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const detail = account.isPending
    ? "Loading account…"
    : account.isError
      ? "Account unavailable"
      : user
        ? `${user.email} · ${user.role}`
        : "Sign in to your account";

  return (
    <Menu>
      <MenuTrigger
        aria-label={user ? `Account menu for ${name}` : "Account menu"}
        disabled={account.isPending}
        render={
          <Button
            variant="ghost"
            size={compact ? "icon" : "default"}
            className={
              compact ? undefined : "h-auto w-full justify-start gap-3 px-2 py-2 sm:h-auto"
            }
          />
        }
      >
        <Avatar className={compact ? "size-7" : "size-9"}>
          {typeof avatarUrl === "string" && <AvatarImage src={avatarUrl} alt="" />}
          <AvatarFallback>{user ? initials : <UserRoundIcon aria-hidden="true" />}</AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
              <span className="w-full truncate text-sm font-medium">{name}</span>
              <span className="w-full truncate text-xs text-muted-foreground">{detail}</span>
            </span>
            <ChevronsUpDownIcon aria-hidden="true" data-icon="inline-end" />
          </>
        )}
      </MenuTrigger>
      <MenuPopup
        align={compact ? "end" : "start"}
        side={compact ? "bottom" : "top"}
        sideOffset={8}
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        <MenuGroup>
          <MenuGroupLabel>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-medium text-foreground">{name}</span>
              <span className="truncate text-xs font-normal">{detail}</span>
            </span>
          </MenuGroupLabel>
          <MenuSeparator />
          {user && (
            <MenuLinkItem render={<Link href="/settings" onClick={() => setOpenMobile(false)} />}>
              <SettingsIcon aria-hidden="true" />
              Account
            </MenuLinkItem>
          )}
          {account.isError ? (
            <MenuItem onClick={() => void account.refetch()}>Retry loading account</MenuItem>
          ) : user ? (
            <MenuItem
              variant="destructive"
              closeOnClick={false}
              disabled={logout.isPending}
              onClick={() => logout.mutate(undefined)}
            >
              <LogOutIcon aria-hidden="true" />
              {logout.isPending ? "Logging out…" : "Log out"}
            </MenuItem>
          ) : (
            <MenuLinkItem render={<Link href="/login" onClick={() => setOpenMobile(false)} />}>
              <LogInIcon aria-hidden="true" />
              Sign in
            </MenuLinkItem>
          )}
        </MenuGroup>
        {logout.isError && (
          <p role="alert" className="px-2 py-1.5 text-xs text-destructive-foreground">
            Couldn’t log out. Please try again.
          </p>
        )}
      </MenuPopup>
    </Menu>
  );
}
