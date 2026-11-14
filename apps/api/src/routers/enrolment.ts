import { and, asc, eq, schema, sql, type Database } from "@lms/db";
import { authUsers } from "@lms/db/auth-schema";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { isAdminEmail } from "#account";
import { sendEnrolmentEmail } from "#mail";
import { studentOS, teacherOS } from "#procedures";

const table = schema.enrolments;

// Recheck the current role on every booking; old enrolments grant no teacher privileges.
export async function requireEnrolledTeacher(
  db: Database,
  studentId: string,
  teacherId: string,
  patterns: string[],
) {
  const [teacher] = await db
    .select({ email: authUsers.email, role: schema.userRoles.role })
    .from(table)
    .leftJoin(schema.userRoles, eq(schema.userRoles.userId, table.teacherId))
    .innerJoin(authUsers, eq(authUsers.id, table.teacherId))
    .where(and(eq(table.studentId, studentId), eq(table.teacherId, teacherId)));
  if (!teacher?.email || (teacher.role !== "teacher" && !isAdminEmail(teacher.email, patterns))) {
    throw new ORPCError("FORBIDDEN", { message: "Choose a teacher who has enrolled you." });
  }
}

async function notify(email: string, teacherName: string | null, hasAccount: boolean) {
  try {
    await sendEnrolmentEmail({ email, teacherName, hasAccount });
    return true;
  } catch (error) {
    console.error("Enrolment email failed", error);
    return false;
  }
}

export const enrolmentRouter = {
  students: teacherOS
    .input(z.object({ page: z.int().min(1).max(10000).default(1) }))
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .select()
        .from(table)
        .where(eq(table.teacherId, context.account.id))
        .orderBy(asc(table.studentEmail), asc(table.id))
        .limit(21)
        .offset((input.page - 1) * 20);
      return { items: rows.slice(0, 20), hasMore: rows.length > 20 };
    }),
  teachers: studentOS.handler(async ({ context }) => {
    const rows = await context.db
      .select({ id: authUsers.id, email: authUsers.email, role: schema.userRoles.role })
      .from(table)
      .innerJoin(authUsers, eq(authUsers.id, table.teacherId))
      .leftJoin(schema.userRoles, eq(schema.userRoles.userId, table.teacherId))
      .where(eq(table.studentId, context.account.id))
      .orderBy(asc(authUsers.email));
    return rows
      .filter(
        (row): row is typeof row & { email: string } =>
          !!row.email &&
          (row.role === "teacher" || isAdminEmail(row.email, context.adminEmailPatterns)),
      )
      .map(({ id, email }) => ({ id, email }));
  }),
  enrol: teacherOS
    .input(z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(255)) }))
    .handler(async ({ context, input }) => {
      if (
        input.email === context.account.email ||
        isAdminEmail(input.email, context.adminEmailPatterns)
      ) {
        throw new ORPCError("BAD_REQUEST", { message: "Enter a student's email address." });
      }
      const [user] = await context.db
        .select({
          id: authUsers.id,
          confirmedAt: authUsers.emailConfirmedAt,
          role: schema.userRoles.role,
        })
        .from(authUsers)
        .leftJoin(schema.userRoles, eq(authUsers.id, schema.userRoles.userId))
        .where(sql`lower(${authUsers.email}) = ${input.email}`);
      if (user?.role === "teacher")
        throw new ORPCError("BAD_REQUEST", { message: "This account is a teacher." });
      const [row] = await context.db
        .insert(table)
        .values({
          teacherId: context.account.id,
          studentEmail: input.email,
          studentId: user?.confirmedAt ? user.id : null,
        })
        .onConflictDoNothing({ target: [table.teacherId, table.studentEmail] })
        .returning();
      if (!row) throw new ORPCError("CONFLICT", { message: "This student is already enrolled." });
      // The enrolment remains saved if mail fails; teachers can retry without duplicating it.
      return { ...row, emailSent: await notify(input.email, context.account.name, !!user) };
    }),
  resend: teacherOS.input(z.object({ id: z.uuid() })).handler(async ({ context, input }) => {
    const [row] = await context.db
      .select()
      .from(table)
      .where(and(eq(table.id, input.id), eq(table.teacherId, context.account.id)));
    if (!row) throw new ORPCError("NOT_FOUND");
    const [user] = await context.db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(sql`lower(${authUsers.email}) = ${row.studentEmail}`);
    return { emailSent: await notify(row.studentEmail, context.account.name, !!user) };
  }),
};
