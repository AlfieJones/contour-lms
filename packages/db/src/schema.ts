import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  smallint,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUsers } from "#auth-schema";

// Only the server accesses this schema; it is not exposed through the Supabase Data API.
export const appSchema = pgSchema("app");

export const userRoles = appSchema.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: varchar({ length: 20, enum: ["student", "teacher"] })
      .notNull()
      .default("student"),
  },
  (table) => [check("user_roles_role_check", sql`${table.role} in ('student', 'teacher')`)],
);

export const consultations = appSchema.table(
  "consultations",
  {
    id: uuid().primaryKey().defaultRandom(),
    studentId: uuid("student_id").references(() => authUsers.id, { onDelete: "cascade" }),
    // Pending students are linked by their verified email when they first sign in.
    studentEmail: varchar("student_email", { length: 255 }),
    // Nullable for bookings made before teacher enrolments were introduced.
    teacherId: uuid("teacher_id").references(() => authUsers.id, { onDelete: "set null" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    reason: text().notNull(),
    durationMinutes: smallint("duration_minutes").notNull().default(30),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    calendarSequence: integer("calendar_sequence").notNull().default(0),
    status: varchar({ length: 20, enum: ["scheduled", "completed", "cancelled"] })
      .notNull()
      .default("scheduled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consultations_student_datetime_idx").on(table.studentId, table.scheduledAt, table.id),
    index("consultations_teacher_datetime_idx").on(table.teacherId, table.scheduledAt, table.id),
    index("consultations_datetime_idx").on(table.scheduledAt, table.id),
    index("consultations_pending_email_idx")
      .on(table.studentEmail)
      .where(sql`${table.studentId} is null`),
    check(
      "consultations_student_check",
      sql`${table.studentId} is not null or (${table.studentEmail} is not null and length(trim(${table.studentEmail})) > 0)`,
    ),
    check(
      "consultations_email_check",
      sql`${table.studentEmail} = lower(trim(${table.studentEmail}))`,
    ),
    check(
      "consultations_status_check",
      sql`${table.status} in ('scheduled', 'completed', 'cancelled')`,
    ),
    check("consultations_names_check", sql`length(trim(${table.firstName})) > 0`),
    check("consultations_duration_check", sql`${table.durationMinutes} in (30, 60, 120)`),
    check("consultations_calendar_sequence_check", sql`${table.calendarSequence} >= 0`),
    check("consultations_reason_check", sql`length(trim(${table.reason})) between 1 and 2000`),
  ],
);

// Immutable per-recipient snapshots let failed updates (including a removed teacher's
// cancellation) be retried without reconstructing an older booking from current data.
export const consultationEmails = appSchema.table(
  "consultation_emails",
  {
    id: uuid().primaryKey().defaultRandom(),
    consultationId: uuid("consultation_id")
      .notNull()
      .references(() => consultations.id, { onDelete: "cascade" }),
    sequence: integer().notNull(),
    recipient: text().notNull(),
    details: jsonb()
      .$type<{
        kind: "booked" | "rescheduled" | "cancelled";
        scheduledAt: string;
        durationMinutes: number;
        studentName: string;
        teacherName: string;
        studentEmail: string | null;
        teacherEmail: string | null;
      }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("consultation_emails_booking_sequence_recipient_idx").on(
      table.consultationId,
      table.sequence,
      table.recipient,
    ),
    check("consultation_emails_sequence_check", sql`${table.sequence} >= 0`),
  ],
);

export const enrolments = appSchema.table(
  "enrolments",
  {
    id: uuid().primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    studentEmail: varchar("student_email", { length: 255 }).notNull(),
    studentName: varchar("student_name", { length: 100 }),
    studentId: uuid("student_id").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("enrolments_teacher_email_idx").on(table.teacherId, table.studentEmail),
    index("enrolments_student_idx").on(table.studentId),
    index("enrolments_pending_email_idx")
      .on(table.studentEmail)
      .where(sql`${table.studentId} is null`),
    check(
      "enrolments_email_check",
      sql`${table.studentEmail} = lower(trim(${table.studentEmail}))`,
    ),
  ],
);

export const teacherAvailability = appSchema.table(
  "teacher_availability",
  {
    id: uuid().primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    // Weekly wall-clock hours in Australia/Perth. Sunday is 0; 1440 is midnight.
    dayOfWeek: integer("day_of_week").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (table) => [
    index("teacher_availability_teacher_idx").on(table.teacherId),
    check("teacher_availability_day_check", sql`${table.dayOfWeek} between 0 and 6`),
    check(
      "teacher_availability_time_check",
      sql`${table.startMinute} >= 0 and ${table.endMinute} <= 1440 and ${table.startMinute} < ${table.endMinute} and ${table.startMinute} % 30 = 0 and ${table.endMinute} % 30 = 0`,
    ),
  ],
);
