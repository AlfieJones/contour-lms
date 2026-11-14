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
ALTER TABLE "app"."consultations" ADD COLUMN "calendar_sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_emails_booking_sequence_recipient_idx" ON "app"."consultation_emails" ("consultation_id","sequence","recipient");--> statement-breakpoint
ALTER TABLE "app"."consultation_emails" ADD CONSTRAINT "consultation_emails_consultation_id_consultations_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "app"."consultations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "app"."consultations" ADD CONSTRAINT "consultations_calendar_sequence_check" CHECK ("calendar_sequence" >= 0);