import { and, asc, eq, ne, schema, getTableColumns } from "@lms/db";
import { authUsers } from "@lms/db/auth-schema";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { adminOS, memberOS, studentOS, teacherOS } from "#procedures";
import { isAdminEmail } from "#account";
import { requireEnrolledTeacher } from "#routers/enrolment";

const table = schema.consultations;
const pageInput = z.object({ page: z.int().min(1).max(10000).default(1) });
const futureDatetime = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((value) => value.getTime() > Date.now(), "Choose a future date and time.");
const idInput = z.object({ id: z.uuid() });
const pageSize = 20;
const bookingInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(2000),
  scheduledAt: futureDatetime,
});

export const consultationRouter = {
  list: memberOS.input(pageInput).handler(async ({ context, input }) => {
    const rows = await context.db
      .select({ ...getTableColumns(table), teacherEmail: authUsers.email })
      .from(table)
      .leftJoin(authUsers, eq(authUsers.id, table.teacherId))
      .where(
        eq(
          context.account.role === "student" ? table.studentId : table.teacherId,
          context.account.id,
        ),
      )
      .orderBy(asc(table.scheduledAt), asc(table.id))
      .limit(pageSize + 1)
      .offset((input.page - 1) * pageSize);
    return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
  }),
  create: studentOS
    .input(bookingInput.extend({ teacherId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireEnrolledTeacher(
        context.db,
        context.account.id,
        input.teacherId,
        context.adminEmailPatterns,
      );
      const [row] = await context.db
        .insert(table)
        .values({ ...input, studentId: context.account.id })
        .returning();
      return row!;
    }),
  createForStudent: teacherOS
    .input(bookingInput.extend({ enrolmentId: z.uuid() }).strict())
    .handler(async ({ context, input }) => {
      const [enrolment] = await context.db
        .select({
          studentId: schema.enrolments.studentId,
          email: authUsers.email,
          confirmedAt: authUsers.emailConfirmedAt,
          role: schema.userRoles.role,
        })
        .from(schema.enrolments)
        .leftJoin(authUsers, eq(authUsers.id, schema.enrolments.studentId))
        .leftJoin(schema.userRoles, eq(schema.userRoles.userId, schema.enrolments.studentId))
        .where(
          and(
            eq(schema.enrolments.id, input.enrolmentId),
            eq(schema.enrolments.teacherId, context.account.id),
          ),
        );
      if (!enrolment) throw new ORPCError("NOT_FOUND", { message: "Student enrolment not found." });
      if (!enrolment.studentId || !enrolment.email || !enrolment.confirmedAt) {
        throw new ORPCError("BAD_REQUEST", {
          message: "The student must verify their account before you can book for them.",
        });
      }
      if (
        enrolment.role === "teacher" ||
        isAdminEmail(enrolment.email, context.adminEmailPatterns)
      ) {
        throw new ORPCError("BAD_REQUEST", { message: "Choose an enrolled student account." });
      }
      const { enrolmentId: _enrolmentId, ...details } = input;
      const [row] = await context.db
        .insert(table)
        .values({ ...details, studentId: enrolment.studentId, teacherId: context.account.id })
        .returning();
      return row!;
    }),
  reschedule: studentOS
    .input(idInput.extend({ scheduledAt: futureDatetime, teacherId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireEnrolledTeacher(
        context.db,
        context.account.id,
        input.teacherId,
        context.adminEmailPatterns,
      );
      const [row] = await context.db
        .update(table)
        .set({ scheduledAt: input.scheduledAt, teacherId: input.teacherId })
        .where(
          and(
            eq(table.id, input.id),
            eq(table.studentId, context.account.id),
            eq(table.status, "scheduled"),
          ),
        )
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Scheduled consultation not found." });
      return row;
    }),
  setComplete: memberOS
    .input(idInput.extend({ complete: z.boolean() }))
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .update(table)
        .set({ status: input.complete ? "completed" : "scheduled" })
        .where(
          and(
            eq(table.id, input.id),
            eq(
              context.account.role === "student" ? table.studentId : table.teacherId,
              context.account.id,
            ),
            ne(table.status, "cancelled"),
          ),
        )
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Active consultation not found." });
      return row;
    }),
  cancel: studentOS.input(idInput).handler(async ({ context, input }) => {
    const [row] = await context.db
      .update(table)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(table.id, input.id),
          eq(table.studentId, context.account.id),
          eq(table.status, "scheduled"),
        ),
      )
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Scheduled consultation not found." });
    return row;
  }),
};

export const adminRouter = {
  consultations: adminOS.input(pageInput).handler(async ({ context, input }) => {
    const rows = await context.db
      .select({ ...getTableColumns(table), teacherEmail: authUsers.email })
      .from(table)
      .leftJoin(authUsers, eq(authUsers.id, table.teacherId))
      .orderBy(asc(table.scheduledAt), asc(table.id))
      .limit(pageSize + 1)
      .offset((input.page - 1) * pageSize);
    return { items: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
  }),
};
