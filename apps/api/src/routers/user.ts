import { ORPCError } from "@orpc/server";
import { publicOS } from "#procedures";
import { loadAccount } from "#account";

export const userRouter = {
  get: publicOS.handler(async ({ context }) => {
    if (!context.claims?.sub) return null;

    const { data, error } = await context.supabase.auth.getUser();
    if (error) throw new ORPCError("UNAUTHORIZED", { cause: error });

    return data.user ? loadAccount(data.user, context.adminEmailPatterns, context.db) : null;
  }),
};
