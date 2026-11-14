import type { User } from "@supabase/supabase-js";
import { and, eq, sql, schema, type Database } from "@lms/db";

export function isAdminEmail(email: string, patterns: string[]) {
  const normalized = email.toLowerCase();
  const domain = normalized.slice(normalized.lastIndexOf("@") + 1);
  return patterns.some((pattern) =>
    pattern.startsWith("*@") ? domain === pattern.slice(2) : normalized === pattern,
  );
}

export function resolveAccount(
  user: User,
  patterns: string[],
  role: "student" | "teacher" = "student",
) {
  if (!user.email || !user.email_confirmed_at || user.is_anonymous) return null;
  const email = user.email.toLowerCase();
  const fullName: unknown = user.user_metadata?.full_name;
  const name = typeof fullName === "string" ? fullName.trim() || null : null;

  return {
    id: user.id,
    email,
    name,
    role: isAdminEmail(email, patterns) ? ("admin" as const) : role,
  };
}

export async function loadAccount(
  user: User,
  patterns: string[],
  db: Database,
): Promise<Account | null> {
  const account = resolveAccount(user, patterns);
  if (!account || account.role === "admin") return account;
  const [stored] = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, account.id));
  const role = stored?.role ?? "student";
  if (role === "student") {
    // Only a verified email can claim an invitation, including all pending teachers.
    await db
      .update(schema.enrolments)
      .set({ studentId: account.id })
      .where(
        and(
          eq(schema.enrolments.studentEmail, account.email),
          sql`${schema.enrolments.studentId} is null`,
        ),
      );
  }
  return { ...account, role };
}

export type Account = NonNullable<ReturnType<typeof resolveAccount>>;
