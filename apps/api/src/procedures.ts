import { ORPCError, os } from "@orpc/server";

import type { ApiContext } from "#context";

export const publicOS = os.$context<ApiContext>().use(async ({ context, next }) => {
  const { data, error } = await context.supabase.auth.getClaims();

  if (error) console.error(error);

  return next({ context: { claims: data?.claims } });
});

export const protectedOS = publicOS.use(({ context, next }) => {
  if (!context.claims?.sub) throw new ORPCError("UNAUTHORIZED");

  return next({ context: { claims: context.claims } });
});
