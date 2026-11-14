"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenIcon,
  CommandIcon,
  LayoutDashboardIcon,
  LogInIcon,
  MoonIcon,
  Settings2Icon,
  SunIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@lms/ui/avatar";
import { Button } from "@lms/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@lms/ui/menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
import { cn } from "@lms/ui/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboardIcon },
  { name: "Courses", href: "/courses", icon: BookOpenIcon },
];

function SidebarLink({ onClick, ...props }: React.ComponentProps<typeof Link>) {
  const { setOpenMobile } = useSidebar();

  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpenMobile(false);
      }}
    />
  );
}

const AppearanceContext = createContext({ dark: false, mounted: false, toggleTheme: () => {} });

function subscribeAppearance(callback: () => void) {
  window.addEventListener("contour-appearance", callback);
  return () => window.removeEventListener("contour-appearance", callback);
}

function getAppearance() {
  return document.documentElement.classList.contains("dark");
}

function AppearanceProvider({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribeAppearance, getAppearance, () => false);
  const mounted = useSyncExternalStore(
    subscribeAppearance,
    () => true,
    () => false,
  );

  useEffect(() => {
    let isDark = false;
    try {
      isDark = localStorage.getItem("contour-theme") === "dark";
    } catch {
      // Appearance remains available when browser storage is disabled.
    }
    document.documentElement.classList.toggle("dark", isDark);
    window.dispatchEvent(new Event("contour-appearance"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    window.dispatchEvent(new Event("contour-appearance"));
    try {
      localStorage.setItem("contour-theme", next ? "dark" : "light");
    } catch {
      // The selected appearance still applies for this session.
    }
  }

  return <AppearanceContext value={{ dark, mounted, toggleTheme }}>{children}</AppearanceContext>;
}

function ThemeToggle() {
  const { dark, mounted, toggleTheme } = useContext(AppearanceContext);
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={!mounted}
      onClick={toggleTheme}
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}

function ProfileMenu() {
  return (
    <Menu>
      <MenuTrigger aria-label="Account menu" render={<Button variant="ghost" size="icon" />}>
        <Avatar className="size-7">
          <AvatarFallback>CO</AvatarFallback>
        </Avatar>
      </MenuTrigger>
      <MenuPopup align="end" className="w-56">
        <MenuGroup>
          <MenuGroupLabel>Contour</MenuGroupLabel>
          <MenuSeparator />
          <MenuLinkItem render={<SidebarLink href="/settings" />}>
            <Settings2Icon />
            Workspace settings
          </MenuLinkItem>
          <MenuLinkItem render={<SidebarLink href="/login" />}>
            <LogInIcon />
            Sign in
          </MenuLinkItem>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="px-4 pt-5 pb-3">
        <div className="flex h-8 items-center gap-1">
          <SidebarLink
            href="/"
            aria-label="Contour home"
            className="mr-auto flex items-center gap-2 text-foreground"
          >
            <CommandIcon className="size-5" />
            <span className="text-lg font-semibold tracking-tight">Contour</span>
          </SidebarLink>
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 py-2">
          <SidebarGroupContent>
            <SidebarMenu aria-label="Main navigation">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    className="h-9"
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
      <SidebarFooter className="gap-4 px-3 pb-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-9"
              isActive={pathname === "/settings"}
              render={
                <SidebarLink
                  href="/settings"
                  aria-current={pathname === "/settings" ? "page" : undefined}
                />
              }
            >
              <Settings2Icon />
              <span>Workspace settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Button
          variant="outline"
          className="w-full justify-between"
          render={<SidebarLink href="/login" />}
        >
          Sign in
          <LogInIcon data-icon="inline-end" />
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = navigation.find((item) => item.href === pathname)?.name ?? "Workspace settings";

  return (
    <AppearanceProvider>
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
              <ThemeToggle />
              <ProfileMenu />
            </div>
          </header>
          <AppSidebar />
          <SidebarInset
            aria-label={title}
            className="min-h-0 min-w-0 overflow-hidden max-md:pt-14 max-md:pb-20 md:rounded-2xl md:border md:shadow-none"
          >
            <div key={pathname} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </SidebarInset>
          <nav
            aria-label="Mobile navigation"
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t bg-background px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2 text-xs text-muted-foreground",
                  pathname === item.href && "bg-accent text-accent-foreground",
                )}
              >
                <item.icon className="size-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>
        </SidebarProvider>
      </TooltipProvider>
    </AppearanceProvider>
  );
}
