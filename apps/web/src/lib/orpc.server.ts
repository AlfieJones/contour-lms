import "server-only";

import { cache } from "react";
import { router } from "@lms/api";
import type { ApiContext } from "@lms/api";
import { getDb } from "@lms/db";
import { env as dbEnv } from "@lms/db/env";
import { env } from "#env.ts";
import { createRouterClient } from "@orpc/server";
import { createAppQueryUtils } from "#lib/orpc-query-utils.ts";
import { createSupabaseServerClient } from "#lib/supabase.server.ts";

export async function createContext(): Promise<ApiContext> {
  const supabase = await createSupabaseServerClient();

  const db = getDb(dbEnv.DATABASE_URL);

  return { supabase, db, adminEmailPatterns: env.ADMIN_EMAIL_PATTERNS };
}

export const serverClient = createRouterClient(router, {
  context: cache(createContext),
});

// Identical keys to the browser utils, with direct procedure calls instead of HTTP.
export const serverOrpc = createAppQueryUtils(serverClient);
