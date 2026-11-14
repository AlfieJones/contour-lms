import { ORPCError } from "@orpc/server";
import * as z from "zod";
import { protectedProcedure, publicProcedure, loadAccount, resolveAccount } from "#procedures";

export const userRouter = {
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        avatarUrl: z
          .url({ protocol: /^https?$/ })
          .max(2048)
          .nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { data, error } = await context.supabase.auth.updateUser({
        data: { full_name: input.name, avatar_url: input.avatarUrl },
      });
      if (error || !data.user)
        throw new ORPCError("BAD_REQUEST", {
          message: "Couldn’t save your profile. Please try again.",
          cause: error,
        });
      return resolveAccount(
        data.user,
        context.adminEmailPatterns,
        context.account.role === "teacher" ? "teacher" : "student",
      );
    }),
  logout: publicProcedure.handler(async ({ context }) => {
    const { error } = await context.supabase.auth.signOut({ scope: "local" });
    if (error) throw new ORPCError("INTERNAL_SERVER_ERROR", { cause: error });
  }),
  get: publicProcedure.handler(async ({ context }) => {
    if (!context.claims?.sub) return null;

    const { data, error } = await context.supabase.auth.getUser();
    if (error) throw new ORPCError("UNAUTHORIZED", { cause: error });

    return data.user ? loadAccount(data.user, context.adminEmailPatterns, context.db) : null;
  }),
};
