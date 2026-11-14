import { asc, eq, schema } from "@lms/db";
import { authUsers } from "@lms/db/auth-schema";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { isAdminEmail } from "#account";
import { adminOS } from "#procedures";

export const adminUserRouter = {
  list: adminOS
    .input(z.object({ page: z.int().min(1).max(10000).default(1) }))
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .select({ id: authUsers.id, email: authUsers.email, role: schema.userRoles.role })
        .from(authUsers)
        .leftJoin(schema.userRoles, eq(authUsers.id, schema.userRoles.userId))
        .orderBy(asc(authUsers.email), asc(authUsers.id))
        .limit(21)
        .offset((input.page - 1) * 20);
      return {
        items: rows.slice(0, 20).map((user) => ({
          id: user.id,
          email: user.email,
          role: isAdminEmail(user.email ?? "", context.adminEmailPatterns)
            ? ("admin" as const)
            : (user.role ?? "student"),
        })),
        hasMore: rows.length > 20,
      };
    }),
  setRole: adminOS
    .input(z.object({ userId: z.uuid(), role: z.enum(["student", "teacher"]) }).strict())
    .handler(async ({ context, input }) => {
      const [user] = await context.db
        .select({ email: authUsers.email })
        .from(authUsers)
        .where(eq(authUsers.id, input.userId));
      if (!user) throw new ORPCError("NOT_FOUND");
      if (isAdminEmail(user.email ?? "", context.adminEmailPatterns)) {
        throw new ORPCError("FORBIDDEN", {
          message: "Admin roles are managed by the email allowlist.",
        });
      }
      await context.db
        .insert(schema.userRoles)
        .values(input)
        .onConflictDoUpdate({ target: schema.userRoles.userId, set: { role: input.role } });
      return { userId: input.userId, role: input.role };
    }),
};
