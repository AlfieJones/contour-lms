import { os } from "@orpc/server";
import { isAuthSessionMissingError, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@lms/db";
import { z } from "zod";

export interface ApiContext {
  supabase: SupabaseClient;
  db: Database;
}

export const sessionSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.string().nullable(),
  }),
});

export type Session = z.infer<typeof sessionSchema>;

export const base = os.$context<ApiContext>();

export const sessionBase = base
  .errors({ SERVICE_UNAVAILABLE: { message: "Authentication is temporarily unavailable." } })
  .use(async ({ context, next, errors }) => {
    // getUser verifies the access token with Supabase. Never trust the cookie's user object.
    const { data, error } = await context.supabase.auth.getUser();
    if (error) {
      if (
        isAuthSessionMissingError(error) ||
        error.status === 401 ||
        error.status === 403 ||
        [
          "bad_jwt",
          "user_not_found",
          "session_not_found",
          "refresh_token_not_found",
          "refresh_token_already_used",
        ].includes(error.code ?? "")
      ) {
        return next({ context: { session: null as Session | null } });
      }
      throw errors.SERVICE_UNAVAILABLE({ cause: error });
    }

    const session: Session | null = data.user
      ? { user: { id: data.user.id, email: data.user.email || null } }
      : null;
    return next({ context: { session } });
  });

export const authenticated = sessionBase
  .errors({ UNAUTHORIZED: { message: "Sign in to continue." } })
  .use(({ context, next, errors }) => {
    if (!context.session) {
      throw errors.UNAUTHORIZED();
    }
    return next({ context: { session: context.session, user: context.session.user } });
  });
