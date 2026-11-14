import { and, eq, schema, sql } from "@lms/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { sendEnrolmentEmail } from "@lms/email/server";
import {
  withTeacherSchedule,
  queueConsultationEmail,
  deliverConsultationEmails,
} from "./consultation.ts";
import { isAdminEmail, studentProcedure, teacherProcedure } from "#procedures";

const table = schema.enrolments;

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
  students: teacherProcedure
    .input(z.object({ page: z.int().min(1).max(10000).default(1) }))
    .handler(async ({ context, input }) => {
      const rows = await context.db.query.enrolments.findMany({
        with: { student: { columns: { rawUserMetaData: true } } },
        where: { teacherId: context.account.id },
        orderBy: { studentEmail: "asc", id: "asc" },
        limit: 21,
        offset: (input.page - 1) * 20,
      });
      const items = rows.slice(0, 20).map(({ student, ...row }) => {
        const studentMetadata = student?.rawUserMetaData;
        const name = studentMetadata?.full_name ?? studentMetadata?.name;
        const avatarUrl = studentMetadata?.avatar_url;
        return {
          ...row,
          studentName: row.studentName ?? (typeof name === "string" ? name.trim() || null : null),
          studentAvatarUrl: typeof avatarUrl === "string" ? avatarUrl.trim() || null : null,
        };
      });
      return { items, hasMore: rows.length > 20 };
    }),
  teachers: studentProcedure.handler(async ({ context }) => {
    const rows = await context.db.query.authUsers.findMany({
      columns: { id: true, email: true, rawUserMetaData: true },
      with: { role: { columns: { role: true } } },
      where: { teacherEnrolments: { studentId: context.account.id } },
      orderBy: { email: "asc" },
    });
    return rows
      .filter(
        (row): row is typeof row & { email: string } =>
          !!row.email &&
          (row.role?.role === "teacher" || isAdminEmail(row.email, context.adminEmailPatterns)),
      )
      .map(({ id, email, rawUserMetaData: metadata }) => {
        const name = metadata?.full_name ?? metadata?.name;
        return { id, email, name: typeof name === "string" ? name.trim() || null : null };
      });
  }),
  enrol: teacherProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100).optional(),
        email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
      }),
    )
    .handler(async ({ context, input }) => {
      if (
        input.email === context.account.email ||
        isAdminEmail(input.email, context.adminEmailPatterns)
      ) {
        throw new ORPCError("BAD_REQUEST", { message: "Enter a student's email address." });
      }
      const user = await context.db.query.authUsers.findFirst({
        columns: { id: true, emailConfirmedAt: true },
        with: { role: { columns: { role: true } } },
        where: { RAW: (user) => sql`lower(${user.email}) = ${input.email}` },
      });
      if (user?.role?.role === "teacher")
        throw new ORPCError("BAD_REQUEST", { message: "This account is a teacher." });
      const [row] = await context.db
        .insert(table)
        .values({
          teacherId: context.account.id,
          studentEmail: input.email,
          studentName: input.name,
          studentId: user?.emailConfirmedAt ? user.id : null,
        })
        .onConflictDoNothing({ target: [table.teacherId, table.studentEmail] })
        .returning();
      if (!row) throw new ORPCError("CONFLICT", { message: "This student is already enrolled." });
      // The enrolment remains saved if mail fails; teachers can retry without duplicating it.
      return { ...row, emailSent: await notify(input.email, context.account.name, !!user) };
    }),
  resend: teacherProcedure.input(z.object({ id: z.uuid() })).handler(async ({ context, input }) => {
    const row = await context.db.query.enrolments.findFirst({
      where: { id: input.id, teacherId: context.account.id },
    });
    if (!row) throw new ORPCError("NOT_FOUND");
    const user = await context.db.query.authUsers.findFirst({
      columns: { id: true },
      where: { RAW: (user) => sql`lower(${user.email}) = ${row.studentEmail}` },
    });
    return { emailSent: await notify(row.studentEmail, context.account.name, !!user) };
  }),
  unenrol: teacherProcedure
    .input(z.object({ id: z.uuid(), cancelUpcoming: z.boolean().default(false) }).strict())
    .handler(async ({ context, input }) => {
      const result = await withTeacherSchedule(context.db, context.account.id, async (tx) => {
        const [row] = await tx
          .delete(table)
          .where(and(eq(table.id, input.id), eq(table.teacherId, context.account.id)))
          .returning({
            id: table.id,
            studentId: table.studentId,
            studentEmail: table.studentEmail,
          });
        if (!row) throw new ORPCError("NOT_FOUND", { message: "Enrolment not found." });
        let cancelledIds: string[] = [];
        if (input.cancelUpcoming) {
          const bookings = schema.consultations;
          const cancelled = await tx
            .update(bookings)
            .set({ status: "cancelled", calendarSequence: sql`${bookings.calendarSequence} + 1` })
            .where(
              and(
                eq(bookings.teacherId, context.account.id),
                eq(bookings.status, "scheduled"),
                sql`${bookings.scheduledAt} > ${new Date()}`,
                sql`(${bookings.studentId} = ${row.studentId} or (${bookings.studentId} is null and ${bookings.studentEmail} = ${row.studentEmail}))`,
              ),
            )
            .returning();
          for (const booking of cancelled) await queueConsultationEmail(tx, booking, "cancelled");
          cancelledIds = cancelled.map((booking) => booking.id);
        }
        return { id: row.id, cancelledIds };
      });
      const sent = await Promise.all(
        result.cancelledIds.map((id) => deliverConsultationEmails(context.db, id)),
      );
      return { id: result.id, emailSent: sent.every(Boolean) };
    }),
};
