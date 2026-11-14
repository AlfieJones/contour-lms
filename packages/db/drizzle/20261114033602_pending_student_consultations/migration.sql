ALTER TABLE "app"."consultations" ADD COLUMN "student_email" varchar(255);--> statement-breakpoint
ALTER TABLE "app"."consultations" ALTER COLUMN "student_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "consultations_pending_email_idx" ON "app"."consultations" ("student_email") WHERE "student_id" is null;--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_student_check" CHECK ("student_id" is not null or ("student_email" is not null and length(trim("student_email")) > 0));--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_email_check" CHECK ("student_email" = lower(trim("student_email")));--> statement-breakpoint
ALTER TABLE "app"."consultations" DROP CONSTRAINT "consultations_names_check", ADD CONSTRAINT "consultations_names_check" CHECK (length(trim("first_name")) > 0);