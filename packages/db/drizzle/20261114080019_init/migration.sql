CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."consultation_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"consultation_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"recipient" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "consultation_emails_sequence_check" CHECK ("sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid,
	"student_email" varchar(255),
	"teacher_id" uuid,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"reason" text NOT NULL,
	"duration_minutes" smallint DEFAULT 30 NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"calendar_sequence" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultations_student_check" CHECK ("student_id" is not null or ("student_email" is not null and length(trim("student_email")) > 0)),
	CONSTRAINT "consultations_email_check" CHECK ("student_email" = lower(trim("student_email"))),
	CONSTRAINT "consultations_status_check" CHECK ("status" in ('scheduled', 'completed', 'cancelled')),
	CONSTRAINT "consultations_names_check" CHECK (length(trim("first_name")) > 0),
	CONSTRAINT "consultations_duration_check" CHECK ("duration_minutes" in (30, 60, 120)),
	CONSTRAINT "consultations_calendar_sequence_check" CHECK ("calendar_sequence" >= 0),
	CONSTRAINT "consultations_reason_check" CHECK (length(trim("reason")) between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "app"."enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"teacher_id" uuid NOT NULL,
	"student_email" varchar(255) NOT NULL,
	"student_name" varchar(100),
	"student_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrolments_email_check" CHECK ("student_email" = lower(trim("student_email")))
);
--> statement-breakpoint
CREATE TABLE "app"."teacher_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"teacher_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	CONSTRAINT "teacher_availability_day_check" CHECK ("day_of_week" between 0 and 6),
	CONSTRAINT "teacher_availability_time_check" CHECK ("start_minute" >= 0 and "end_minute" <= 1440 and "start_minute" < "end_minute" and "start_minute" % 30 = 0 and "end_minute" % 30 = 0)
);
--> statement-breakpoint
CREATE TABLE "app"."user_roles" (
	"user_id" uuid PRIMARY KEY,
	"role" varchar(20) DEFAULT 'student' NOT NULL,
	CONSTRAINT "user_roles_role_check" CHECK ("role" in ('student', 'teacher'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_emails_booking_sequence_recipient_idx" ON "app"."consultation_emails" ("consultation_id","sequence","recipient");--> statement-breakpoint
CREATE INDEX "consultations_student_datetime_idx" ON "app"."consultations" ("student_id","scheduled_at","id");--> statement-breakpoint
CREATE INDEX "consultations_teacher_datetime_idx" ON "app"."consultations" ("teacher_id","scheduled_at","id");--> statement-breakpoint
CREATE INDEX "consultations_datetime_idx" ON "app"."consultations" ("scheduled_at","id");--> statement-breakpoint
CREATE INDEX "consultations_pending_email_idx" ON "app"."consultations" ("student_email") WHERE "student_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "enrolments_teacher_email_idx" ON "app"."enrolments" ("teacher_id","student_email");--> statement-breakpoint
CREATE INDEX "enrolments_student_idx" ON "app"."enrolments" ("student_id");--> statement-breakpoint
CREATE INDEX "enrolments_pending_email_idx" ON "app"."enrolments" ("student_email") WHERE "student_id" is null;--> statement-breakpoint
CREATE INDEX "teacher_availability_teacher_idx" ON "app"."teacher_availability" ("teacher_id");--> statement-breakpoint
ALTER TABLE "app"."consultation_emails" ADD CONSTRAINT "consultation_emails_consultation_id_consultations_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "app"."consultations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_student_id_users_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_teacher_id_users_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app"."enrolments" ADD CONSTRAINT "enrolments_teacher_id_users_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."enrolments" ADD CONSTRAINT "enrolments_student_id_users_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app"."teacher_availability" ADD CONSTRAINT "teacher_availability_teacher_id_users_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;