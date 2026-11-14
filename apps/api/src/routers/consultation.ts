import { and, eq, ne, schema, sql, type Database } from "@lms/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { sendConsultationEmail } from "@lms/email/server";
import {
  adminProcedure,
  protectedProcedure,
  studentProcedure,
  teacherProcedure,
  isAdminEmail,
  requireEnrolledTeacher,
  type Transaction,
} from "#procedures";
import {
  AVAILABILITY_TIME_ZONE,
  BOOKING_WINDOW_DAYS,
  generateAvailableSlots,
  isAvailableTime,
} from "./consultation-scheduling.ts";

// Booking writes, availability edits and unenrolments share this transaction-scoped lock.
// A second request must recheck the committed schedule before claiming a slot.
export function withTeacherSchedule<T>(
  db: Database,
  teacherId: string,
  action: (tx: Transaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`consultation:${teacherId}`}, 0))`,
    );
    return action(tx);
  });
}

type Consultation = typeof schema.consultations.$inferSelect;
type Kind = typeof schema.consultationEmails.$inferSelect.details.kind;
const emails = schema.consultationEmails;

export async function queueConsultationEmail(
  tx: Transaction,
  booking: Consultation,
  kind: Kind,
  removedTeacherOnly = false,
) {
  const teacher = booking.teacherId
    ? await tx.query.authUsers.findFirst({
        columns: { email: true },
        extras: { name: (user) => sql<unknown>`${user.rawUserMetaData} ->> 'full_name'` },
        where: { id: booking.teacherId },
      })
    : undefined;
  const student =
    booking.studentId && !booking.studentEmail
      ? await tx.query.authUsers.findFirst({
          columns: { email: true },
          where: { id: booking.studentId },
        })
      : undefined;
  const studentEmail = booking.studentEmail ?? student?.email ?? null;
  const teacherEmail = teacher?.email ?? null;
  const teacherName = teacher?.name;
  const recipients = [
    ...new Set(
      (removedTeacherOnly ? [teacherEmail] : [studentEmail, teacherEmail]).filter(
        (email) => email !== null,
      ),
    ),
  ];
  if (!recipients.length) return;
  await tx
    .insert(emails)
    .values(
      recipients.map((recipient) => ({
        consultationId: booking.id,
        sequence: booking.calendarSequence,
        recipient,
        details: {
          kind,
          scheduledAt: booking.scheduledAt.toISOString(),
          durationMinutes: booking.durationMinutes,
          studentName: `${booking.firstName} ${booking.lastName}`.trim(),
          teacherName:
            typeof teacherName === "string" && teacherName.trim()
              ? teacherName.trim()
              : (teacherEmail ?? "Your teacher"),
          studentEmail,
          teacherEmail,
        },
      })),
    )
    .onConflictDoNothing({ target: [emails.consultationId, emails.sequence, emails.recipient] });
}

// Deliver after commit: SMTP failure must never undo a saved booking. Calendar UID
// and SEQUENCE make retries and out-of-order deliveries safe for calendar clients.
export async function deliverConsultationEmails(
  db: Database,
  consultationId: string,
  resendSequence?: number,
) {
  try {
    const pending = await db.query.consultationEmails.findMany({
      where: {
        consultationId,
        ...(resendSequence === undefined
          ? { sentAt: { isNull: true } }
          : { OR: [{ sentAt: { isNull: true } }, { sequence: resendSequence }] }),
      },
      orderBy: { sequence: "asc", createdAt: "asc" },
    });
    let sent = pending.length > 0;
    for (const email of pending) {
      try {
        await sendConsultationEmail({
          ...email.details,
          consultationId,
          sequence: email.sequence,
          recipient: email.recipient,
          updatedAt: email.createdAt.toISOString(),
        });
        await db.update(emails).set({ sentAt: new Date() }).where(eq(emails.id, email.id));
      } catch {
        // Do not log addresses, booking content, or SMTP credentials from errors.
        console.error("Consultation email delivery failed", { deliveryId: email.id });
        sent = false;
      }
    }
    return sent;
  } catch {
    console.error("Consultation email delivery could not be started", { consultationId });
    return false;
  }
}

const availability = schema.teacherAvailability;
const maximumDuration = 120 * 60_000;

const availabilityInput = z
  .object({
    windows: z
      .array(
        z
          .object({
            dayOfWeek: z.int().min(0).max(6),
            startMinute: z.int().min(0).max(1410).multipleOf(30),
            endMinute: z.int().min(30).max(1440).multipleOf(30),
          })
          .strict(),
      )
      .max(28),
  })
  .strict()
  .superRefine(({ windows }, ctx) => {
    for (const [index, window] of windows.entries()) {
      if (window.endMinute <= window.startMinute) {
        ctx.addIssue({
          code: "custom",
          path: ["windows", index],
          message: "End time must be after start time.",
        });
      }
      if (
        windows
          .slice(0, index)
          .some(
            (other) =>
              other.dayOfWeek === window.dayOfWeek &&
              other.startMinute < window.endMinute &&
              window.startMinute < other.endMinute,
          )
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["windows", index],
          message: "Time ranges on the same day must not overlap.",
        });
      }
    }
  });

function readAvailability(db: Database | Transaction, teacherId: string) {
  return db.query.teacherAvailability.findMany({
    columns: { dayOfWeek: true, startMinute: true, endMinute: true },
    where: { teacherId },
    orderBy: { dayOfWeek: "asc", startMinute: "asc" },
  });
}

async function requireAvailableSlot(
  tx: Transaction,
  teacherId: string,
  scheduledAt: Date,
  durationMinutes: number,
  excludeId?: string,
) {
  const windows = await readAvailability(tx, teacherId);
  if (!isAvailableTime(scheduledAt, windows, new Date(), durationMinutes)) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "Choose a time within the teacher’s published availability, at least one hour ahead and within 90 days.",
    });
  }
  const conflict = await tx.query.consultations.findFirst({
    columns: { id: true },
    where: {
      teacherId,
      status: { ne: "cancelled" },
      ...(excludeId ? { id: { ne: excludeId } } : {}),
      scheduledAt: {
        gt: new Date(scheduledAt.getTime() - maximumDuration),
        lt: new Date(scheduledAt.getTime() + durationMinutes * 60_000),
      },
      RAW: (booking) =>
        sql`${booking.scheduledAt} + ${booking.durationMinutes} * interval '1 minute' > ${scheduledAt}`,
    },
  });
  if (conflict)
    throw new ORPCError("CONFLICT", {
      message: "That time was just booked. Choose another available time.",
    });
}

const consultationAvailabilityRouter = {
  get: teacherProcedure.handler(async ({ context }) => ({
    windows: await readAvailability(context.db, context.account.id),
    timeZone: AVAILABILITY_TIME_ZONE,
  })),
  save: teacherProcedure.input(availabilityInput).handler(({ context, input }) =>
    withTeacherSchedule(context.db, context.account.id, async (tx) => {
      await tx.delete(availability).where(eq(availability.teacherId, context.account.id));
      if (input.windows.length > 0) {
        await tx.insert(availability).values(
          input.windows.map((window) => ({
            ...window,
            teacherId: context.account.id,
          })),
        );
      }
      return {
        windows: await readAvailability(tx, context.account.id),
        timeZone: AVAILABILITY_TIME_ZONE,
      };
    }),
  ),
  slots: protectedProcedure
    .input(
      z
        .object({
          teacherId: z.uuid(),
          durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(120)]).default(30),
          consultationId: z.uuid().optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (context.account.role === "student") {
        await requireEnrolledTeacher(
          context.db,
          context.account.id,
          input.teacherId,
          context.adminEmailPatterns,
        );
      } else if (input.teacherId !== context.account.id) {
        throw new ORPCError("FORBIDDEN");
      }
      if (input.consultationId) {
        const owned = await context.db.query.consultations.findFirst({
          columns: { id: true },
          where: {
            id: input.consultationId,
            ...(context.account.role === "student"
              ? { studentId: context.account.id }
              : { teacherId: context.account.id }),
            status: "scheduled",
          },
        });
        if (!owned) throw new ORPCError("NOT_FOUND");
      }
      const now = new Date();
      const [windows, bookings] = await Promise.all([
        readAvailability(context.db, input.teacherId),
        context.db.query.consultations.findMany({
          columns: { scheduledAt: true, durationMinutes: true },
          where: {
            teacherId: input.teacherId,
            status: { ne: "cancelled" },
            ...(input.consultationId ? { id: { ne: input.consultationId } } : {}),
            scheduledAt: {
              gt: new Date(now.getTime() - maximumDuration),
              lte: new Date(now.getTime() + BOOKING_WINDOW_DAYS * 86400_000),
            },
          },
        }),
      ]);
      return { slots: generateAvailableSlots(windows, bookings, now, input.durationMinutes) };
    }),
};

function studentBookingName(
  enrolledName: string | null,
  metadata: { full_name?: unknown; name?: unknown } | null,
  email: string,
) {
  const savedName = [enrolledName, metadata?.full_name, metadata?.name].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  const [firstName, ...lastName] = (savedName ?? email.split("@")[0]!).trim().split(/\s+/);
  return { firstName: firstName!.slice(0, 100), lastName: lastName.join(" ").slice(0, 100) };
}

const table = schema.consultations;
type ProfileMetadata = { full_name?: unknown; name?: unknown; avatar_url?: unknown };
const consultationProfiles = {
  teacher: { columns: { email: true, rawUserMetaData: true } },
  student: { columns: { rawUserMetaData: true } },
} as const;

function profileText(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function withProfiles<
  T extends {
    teacher: { email: string | null; rawUserMetaData: ProfileMetadata | null } | null;
    student: { rawUserMetaData: ProfileMetadata | null } | null;
  },
>(rows: T[]) {
  return rows.map(({ teacher, student, ...row }) => ({
    ...row,
    teacherEmail: teacher?.email ?? null,
    teacherName: profileText(teacher?.rawUserMetaData?.full_name ?? teacher?.rawUserMetaData?.name),
    teacherAvatarUrl: profileText(teacher?.rawUserMetaData?.avatar_url),
    studentAvatarUrl: profileText(student?.rawUserMetaData?.avatar_url),
  }));
}

const calendarRange = z
  .object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) })
  .refine(({ start, end }) => {
    const duration = Date.parse(end) - Date.parse(start);
    // Allow daylight-saving weeks, but keep calendar reads bounded.
    return duration > 0 && duration <= 8 * 86400_000;
  }, "Choose a calendar range of up to eight days.");
const pageInput = z.object({
  page: z.int().min(1).max(10000).default(1),
  range: calendarRange.optional(),
});

function inCalendarRange(range: z.infer<typeof calendarRange> | undefined) {
  if (!range) return undefined;
  const start = new Date(range.start);
  return {
    // The maximum duration is two hours; retain the existing datetime indexes.
    scheduledAt: {
      gte: new Date(start.getTime() - 2 * 3600_000),
      lt: new Date(range.end),
    },
    RAW: (booking: typeof table) =>
      sql`${booking.scheduledAt} + ${booking.durationMinutes} * interval '1 minute' > ${start}`,
  };
}
const futureDatetime = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((value) => value.getTime() > Date.now(), "Choose a future date and time.");
const idInput = z.object({ id: z.uuid() });
const pageSize = 20;
const durationInput = z
  .int()
  .refine((value) => [30, 60, 120].includes(value), "Choose 30 minutes, 1 hour, or 2 hours.");
const bookingInput = z.object({
  durationMinutes: durationInput.default(30),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(2000),
  scheduledAt: futureDatetime,
});

export const consultationRouter = {
  availability: consultationAvailabilityRouter,
  list: protectedProcedure.input(pageInput).handler(async ({ context, input }) => {
    const rows = await context.db.query.consultations.findMany({
      with: consultationProfiles,
      where: {
        ...(context.account.role === "student"
          ? { studentId: context.account.id }
          : { teacherId: context.account.id }),
        ...inCalendarRange(input.range),
      },
      orderBy: { scheduledAt: "asc", id: "asc" },
      ...(!input.range ? { limit: pageSize + 1, offset: (input.page - 1) * pageSize } : {}),
    });
    if (input.range) return { items: withProfiles(rows), hasMore: false };
    return { items: withProfiles(rows.slice(0, pageSize)), hasMore: rows.length > pageSize };
  }),
  create: studentProcedure
    .input(
      bookingInput.partial({ firstName: true, lastName: true }).extend({ teacherId: z.uuid() }),
    )
    .handler(async ({ context, input }) => {
      const row = await withTeacherSchedule(context.db, input.teacherId, async (tx) => {
        const enrolment = await requireEnrolledTeacher(
          tx,
          context.account.id,
          input.teacherId,
          context.adminEmailPatterns,
        );
        await requireAvailableSlot(tx, input.teacherId, input.scheduledAt, input.durationMinutes);
        const name = studentBookingName(
          enrolment.studentName,
          { full_name: context.account.name },
          context.account.email,
        );
        const [row] = await tx
          .insert(table)
          .values({
            ...input,
            firstName: input.firstName ?? name.firstName,
            lastName: input.lastName ?? name.lastName,
            studentId: context.account.id,
            studentEmail: context.account.email,
          })
          .returning();
        await queueConsultationEmail(tx, row!, "booked");
        return row!;
      });
      return { ...row, emailSent: await deliverConsultationEmails(context.db, row.id) };
    }),
  createForStudent: teacherProcedure
    .input(
      bookingInput
        .omit({ firstName: true, lastName: true })
        .extend({ enrolmentId: z.uuid() })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      const row = await withTeacherSchedule(context.db, context.account.id, async (tx) => {
        const enrolment = await tx.query.enrolments.findFirst({
          columns: { studentId: true, studentEmail: true, studentName: true },
          where: { id: input.enrolmentId, teacherId: context.account.id },
          with: {
            student: {
              columns: { id: true, email: true, emailConfirmedAt: true, rawUserMetaData: true },
              with: { role: { columns: { role: true } } },
            },
          },
        });
        if (!enrolment)
          throw new ORPCError("NOT_FOUND", { message: "Student enrolment not found." });
        // Pending enrolments may already have an Auth account that has not signed in yet.
        const student = enrolment.studentId
          ? enrolment.student
          : await tx.query.authUsers.findFirst({
              columns: { id: true, email: true, emailConfirmedAt: true, rawUserMetaData: true },
              with: { role: { columns: { role: true } } },
              where: { RAW: (user) => sql`lower(${user.email}) = ${enrolment.studentEmail}` },
            });
        if (
          student?.role?.role === "teacher" ||
          isAdminEmail(student?.email ?? enrolment.studentEmail, context.adminEmailPatterns)
        ) {
          throw new ORPCError("BAD_REQUEST", { message: "Choose an enrolled student account." });
        }
        const { enrolmentId: _enrolmentId, ...details } = input;
        const studentId = student?.emailConfirmedAt ? student.id : null;
        const name = studentBookingName(
          enrolment.studentName,
          student?.rawUserMetaData ?? null,
          enrolment.studentEmail,
        );
        await requireAvailableSlot(
          tx,
          context.account.id,
          input.scheduledAt,
          input.durationMinutes,
        );
        const [row] = await tx
          .insert(table)
          .values({
            ...details,
            ...name,
            studentId,
            studentEmail: enrolment.studentEmail,
            teacherId: context.account.id,
          })
          .returning();
        await queueConsultationEmail(tx, row!, "booked");
        return row!;
      });
      return { ...row, emailSent: await deliverConsultationEmails(context.db, row.id) };
    }),
  reschedule: protectedProcedure
    .input(
      idInput.extend({
        scheduledAt: futureDatetime,
        teacherId: z.uuid(),
        durationMinutes: durationInput.optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const student = context.account.role === "student";
      if (!student && input.teacherId !== context.account.id) throw new ORPCError("FORBIDDEN");
      const row = await withTeacherSchedule(context.db, input.teacherId, async (tx) => {
        if (student) {
          await requireEnrolledTeacher(
            tx,
            context.account.id,
            input.teacherId,
            context.adminEmailPatterns,
          );
        }
        const owned = and(
          eq(table.id, input.id),
          eq(student ? table.studentId : table.teacherId, context.account.id),
          eq(table.status, "scheduled"),
        );
        // The relational API cannot lock rows; retain FOR UPDATE for concurrent edits.
        const [existing] = await tx.select().from(table).where(owned).for("update");
        if (!existing)
          throw new ORPCError("NOT_FOUND", { message: "Scheduled consultation not found." });
        const durationMinutes = input.durationMinutes ?? existing.durationMinutes;
        await requireAvailableSlot(
          tx,
          input.teacherId,
          input.scheduledAt,
          durationMinutes,
          input.id,
        );
        const [row] = await tx
          .update(table)
          .set({
            scheduledAt: input.scheduledAt,
            teacherId: input.teacherId,
            durationMinutes,
            calendarSequence: sql`${table.calendarSequence} + 1`,
          })
          .where(owned)
          .returning();
        if (!row)
          throw new ORPCError("NOT_FOUND", { message: "Scheduled consultation not found." });
        if (existing.teacherId !== row.teacherId) {
          await queueConsultationEmail(
            tx,
            { ...existing, calendarSequence: row.calendarSequence },
            "cancelled",
            true,
          );
        }
        await queueConsultationEmail(tx, row, "rescheduled");
        return row;
      });
      return { ...row, emailSent: await deliverConsultationEmails(context.db, row.id) };
    }),
  setComplete: protectedProcedure
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
  cancel: studentProcedure.input(idInput).handler(async ({ context, input }) => {
    const row = await context.db.transaction(async (tx) => {
      const [row] = await tx
        .update(table)
        .set({ status: "cancelled", calendarSequence: sql`${table.calendarSequence} + 1` })
        .where(
          and(
            eq(table.id, input.id),
            eq(table.studentId, context.account.id),
            eq(table.status, "scheduled"),
          ),
        )
        .returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Scheduled consultation not found." });
      await queueConsultationEmail(tx, row, "cancelled");
      return row;
    });
    return { ...row, emailSent: await deliverConsultationEmails(context.db, row.id) };
  }),
  resendCalendarEmail: protectedProcedure.input(idInput).handler(async ({ context, input }) => {
    const row = await context.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(table)
        .where(
          and(
            eq(table.id, input.id),
            eq(
              context.account.role === "student" ? table.studentId : table.teacherId,
              context.account.id,
            ),
          ),
        )
        .for("update");
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Consultation not found." });
      await queueConsultationEmail(
        tx,
        row,
        row.status === "cancelled"
          ? "cancelled"
          : row.calendarSequence > 0
            ? "rescheduled"
            : "booked",
      );
      return row;
    });
    return { emailSent: await deliverConsultationEmails(context.db, row.id, row.calendarSequence) };
  }),
};

export const adminRouter = {
  consultations: adminProcedure.input(pageInput).handler(async ({ context, input }) => {
    const rows = await context.db.query.consultations.findMany({
      with: consultationProfiles,
      where: inCalendarRange(input.range) ?? {},
      orderBy: { scheduledAt: "asc", id: "asc" },
      ...(!input.range ? { limit: pageSize + 1, offset: (input.page - 1) * pageSize } : {}),
    });
    if (input.range) return { items: withProfiles(rows), hasMore: false };
    return { items: withProfiles(rows.slice(0, pageSize)), hasMore: rows.length > pageSize };
  }),
};
