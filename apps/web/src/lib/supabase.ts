"use client";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "#env.client.ts";

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
