"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronsUpDownIcon, LogInIcon, LogOutIcon, UserRoundIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@lms/ui/avatar";
import { Button } from "@lms/ui/button";
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
import { useSidebar } from "@lms/ui/sidebar";
import { orpc } from "#lib/orpc.ts";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
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
    <Menu open={open} onOpenChange={setOpen}>
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
