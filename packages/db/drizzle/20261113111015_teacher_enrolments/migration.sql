CREATE TABLE "app"."enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"teacher_id" uuid NOT NULL,
	"student_email" varchar(255) NOT NULL,
	"student_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrolments_email_check" CHECK ("student_email" = lower(trim("student_email")))
);
--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD COLUMN "teacher_id" uuid;--> statement-breakpoint
CREATE INDEX "consultations_teacher_datetime_idx" ON "app"."consultations" ("teacher_id","scheduled_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrolments_teacher_email_idx" ON "app"."enrolments" ("teacher_id","student_email");--> statement-breakpoint
CREATE INDEX "enrolments_student_idx" ON "app"."enrolments" ("student_id");--> statement-breakpoint
CREATE INDEX "enrolments_pending_email_idx" ON "app"."enrolments" ("student_email") WHERE "student_id" is null;--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_teacher_id_users_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "app"."enrolments" ADD CONSTRAINT "enrolments_teacher_id_users_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."enrolments" ADD CONSTRAINT "enrolments_student_id_users_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
--> statement-breakpoint
REVOKE ALL ON app.enrolments FROM PUBLIC, anon, authenticated;
