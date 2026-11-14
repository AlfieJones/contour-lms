CREATE TABLE "app"."teacher_schedule_settings" (
	"teacher_id" uuid PRIMARY KEY,
	"time_zone" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."teacher_schedule_settings" ADD CONSTRAINT "teacher_schedule_settings_teacher_id_users_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- Existing hours were interpreted in Perth. Preserve them until the teacher edits
-- their timezone; the demo seed explicitly switches its teacher to Melbourne.
INSERT INTO "app"."teacher_schedule_settings" ("teacher_id", "time_zone")
SELECT DISTINCT "teacher_id", 'Australia/Perth'
FROM "app"."teacher_availability";
