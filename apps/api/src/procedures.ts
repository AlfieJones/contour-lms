import type { User } from "@supabase/supabase-js";
import { and, eq, sql, schema, type Database } from "@lms/db";
import { ORPCError, os } from "@orpc/server";
import type { ApiContext } from "#context";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export function isAdminEmail(email: string, patterns: string[]) {
  const normalized = email.toLowerCase();
  const domain = normalized.slice(normalized.lastIndexOf("@") + 1);
  return patterns.some((pattern) =>
    pattern.startsWith("*@") ? domain === pattern.slice(2) : normalized === pattern,
  );
}

export function requiresMfa(user: User, assuranceLevel: unknown) {
  return (
    assuranceLevel !== "aal2" &&
    user.factors?.some((factor) => factor.status === "verified") === true
  );
}

export function resolveAccount(
  user: User,
  patterns: string[],
  role: "student" | "teacher" = "student",
) {
  if (!user.email || !user.email_confirmed_at || user.is_anonymous) return null;
  const email = user.email.toLowerCase();
  const fullName: unknown = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const avatarUrl: unknown = user.user_metadata?.avatar_url;
  const name = typeof fullName === "string" ? fullName.trim() || null : null;

  return {
    id: user.id,
    email,
    name,
    avatarUrl: typeof avatarUrl === "string" ? avatarUrl.trim() || null : null,
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
  const stored = await db.query.userRoles.findFirst({
    columns: { role: true },
    where: { userId: account.id },
  });
  const role = stored?.role ?? "student";
  if (role === "student") {
    // Only a verified email can claim an invitation, including all pending teachers.
    await db.transaction(async (tx) => {
      await tx
        .update(schema.enrolments)
        .set({ studentId: account.id })
        .where(
          and(
            eq(schema.enrolments.studentEmail, account.email),
            sql`${schema.enrolments.studentId} is null`,
          ),
        );
      await tx
        .update(schema.consultations)
        .set({ studentId: account.id })
        .where(
          and(
            eq(schema.consultations.studentEmail, account.email),
            sql`${schema.consultations.studentId} is null`,
          ),
        );
    });
  }
  return { ...account, role };
}

export type Account = NonNullable<ReturnType<typeof resolveAccount>>;

// Recheck the current role on every booking; old enrolments grant no teacher privileges.
export async function requireEnrolledTeacher(
  db: Database | Transaction,
  studentId: string,
  teacherId: string,
  patterns: string[],
) {
  const enrolment = await db.query.enrolments.findFirst({
    columns: { studentName: true },
    where: { studentId, teacherId },
    with: {
      teacher: {
        columns: { email: true },
        with: { role: { columns: { role: true } } },
      },
    },
  });
  const teacher = enrolment?.teacher;
  if (
    !teacher?.email ||
    (teacher.role?.role !== "teacher" && !isAdminEmail(teacher.email, patterns))
  ) {
    throw new ORPCError("FORBIDDEN", { message: "Choose a teacher who has enrolled you." });
  }
  return {
    email: teacher.email,
    role: teacher.role?.role ?? null,
    studentName: enrolment!.studentName,
  };
}

export const publicProcedure = os.$context<ApiContext>().use(async ({ context, next }) => {
  const { data, error } = await context.supabase.auth.getClaims();

  if (error) console.error(error);

  return next({ context: { claims: data?.claims } });
});

export const protectedProcedure = publicProcedure.use(async ({ context, next }) => {
  if (!context.claims?.sub) throw new ORPCError("UNAUTHORIZED");

  const { data, error } = await context.supabase.auth.getUser();
  if (error || !data.user) throw new ORPCError("UNAUTHORIZED");
  if (requiresMfa(data.user, context.claims.aal))
    throw new ORPCError("FORBIDDEN", {
      message: "Verify your two-factor authentication code before continuing.",
    });
  const account = await loadAccount(data.user, context.adminEmailPatterns, context.db);
  if (!account)
    throw new ORPCError("FORBIDDEN", { message: "Verify your email before continuing." });

  return next({ context: { account } });
});

export const adminProcedure = protectedProcedure.use(({ context, next }) => {
  if (context.account.role !== "admin") throw new ORPCError("FORBIDDEN");
  return next();
});

export const studentProcedure = protectedProcedure.use(({ context, next }) => {
  if (context.account.role !== "student") throw new ORPCError("FORBIDDEN");
  return next();
});

export const teacherProcedure = protectedProcedure.use(({ context, next }) => {
  if (context.account.role === "student") throw new ORPCError("FORBIDDEN");
  return next();
});
