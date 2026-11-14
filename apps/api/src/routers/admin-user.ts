import { schema } from "@lms/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { isAdminEmail, adminProcedure } from "#procedures";

export const adminUserRouter = {
  list: adminProcedure
    .input(z.object({ page: z.int().min(1).max(10000).default(1) }))
    .handler(async ({ context, input }) => {
      const rows = await context.db.query.authUsers.findMany({
        columns: { id: true, email: true, rawUserMetaData: true },
        with: { role: { columns: { role: true } } },
        orderBy: { email: "asc", id: "asc" },
        limit: 21,
        offset: (input.page - 1) * 20,
      });
      return {
        items: rows.slice(0, 20).map((user) => {
          const name = user.rawUserMetaData?.full_name ?? user.rawUserMetaData?.name;
          return {
            id: user.id,
            name: typeof name === "string" ? name.trim() || null : null,
            email: user.email,
            role: isAdminEmail(user.email ?? "", context.adminEmailPatterns)
              ? ("admin" as const)
              : (user.role?.role ?? "student"),
          };
        }),
        hasMore: rows.length > 20,
      };
    }),
  setRole: adminProcedure
    .input(z.object({ userId: z.uuid(), role: z.enum(["student", "teacher"]) }).strict())
    .handler(async ({ context, input }) => {
      const user = await context.db.query.authUsers.findFirst({
        columns: { email: true },
        where: { id: input.userId },
      });
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
