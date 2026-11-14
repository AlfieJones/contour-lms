CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"reason" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultations_status_check" CHECK ("status" in ('scheduled', 'completed', 'cancelled')),
	CONSTRAINT "consultations_names_check" CHECK (length(trim("first_name")) > 0 and length(trim("last_name")) > 0),
	CONSTRAINT "consultations_reason_check" CHECK (length(trim("reason")) between 1 and 2000)
);
--> statement-breakpoint
CREATE INDEX "consultations_student_datetime_idx" ON "app"."consultations" ("student_id","scheduled_at","id");--> statement-breakpoint
CREATE INDEX "consultations_datetime_idx" ON "app"."consultations" ("scheduled_at","id");--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_student_id_users_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;