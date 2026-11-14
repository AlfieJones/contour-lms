import { ORPCError, os } from "@orpc/server";

import type { ApiContext } from "#context";
import { loadAccount } from "#account";

export const publicOS = os.$context<ApiContext>().use(async ({ context, next }) => {
  const { data, error } = await context.supabase.auth.getClaims();

  if (error) console.error(error);

  return next({ context: { claims: data?.claims } });
});

export const protectedOS = publicOS.use(async ({ context, next }) => {
  if (!context.claims?.sub) throw new ORPCError("UNAUTHORIZED");

  const { data, error } = await context.supabase.auth.getUser();
  if (error || !data.user) throw new ORPCError("UNAUTHORIZED");
  const account = await loadAccount(data.user, context.adminEmailPatterns, context.db);
  if (!account)
    throw new ORPCError("FORBIDDEN", { message: "Verify your email before continuing." });

  return next({ context: { account } });
});

export const memberOS = protectedOS;

export const adminOS = protectedOS.use(({ context, next }) => {
  if (context.account.role !== "admin") throw new ORPCError("FORBIDDEN");
  return next();
});

export const studentOS = protectedOS.use(({ context, next }) => {
  if (context.account.role !== "student") throw new ORPCError("FORBIDDEN");
  return next();
});

export const teacherOS = protectedOS.use(({ context, next }) => {
  if (context.account.role === "student") throw new ORPCError("FORBIDDEN");
  return next();
});
