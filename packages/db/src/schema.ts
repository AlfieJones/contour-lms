import { sql } from "drizzle-orm";
import {
  check,
  index,
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
    studentId: uuid("student_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    // Nullable for bookings made before teacher enrolments were introduced.
    teacherId: uuid("teacher_id").references(() => authUsers.id, { onDelete: "set null" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    reason: text().notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: varchar({ length: 20, enum: ["scheduled", "completed", "cancelled"] })
      .notNull()
      .default("scheduled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consultations_student_datetime_idx").on(table.studentId, table.scheduledAt, table.id),
    index("consultations_teacher_datetime_idx").on(table.teacherId, table.scheduledAt, table.id),
    index("consultations_datetime_idx").on(table.scheduledAt, table.id),
    check(
      "consultations_status_check",
      sql`${table.status} in ('scheduled', 'completed', 'cancelled')`,
    ),
    check(
      "consultations_names_check",
      sql`length(trim(${table.firstName})) > 0 and length(trim(${table.lastName})) > 0`,
    ),
    check("consultations_reason_check", sql`length(trim(${table.reason})) between 1 and 2000`),
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
