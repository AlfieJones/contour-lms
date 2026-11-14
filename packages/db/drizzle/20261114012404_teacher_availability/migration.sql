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
CREATE INDEX "teacher_availability_teacher_idx" ON "app"."teacher_availability" ("teacher_id");--> statement-breakpoint
ALTER TABLE "app"."teacher_availability" ADD CONSTRAINT "teacher_availability_teacher_id_users_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
REVOKE ALL ON app.teacher_availability FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON app.teacher_availability TO lms_app;
