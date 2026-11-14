import { router } from "@lms/api";
import type { ApiContext } from "@lms/api";
import { getDb } from "@lms/db";
import { env } from "@lms/env/server";
import { createRouterClient } from "@orpc/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createContext(): Promise<ApiContext> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => {
          c.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );

  const db = getDb(env.DATABASE_URL);

  return { supabase, db };
}

// Used by orpc.ts to override the client,
// skipping any network hops and executing the queries directly
globalThis.$client = createRouterClient(router, {
  context: createContext,
});
