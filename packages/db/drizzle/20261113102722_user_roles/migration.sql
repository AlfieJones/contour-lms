CREATE TABLE "app"."user_roles" (
	"user_id" uuid PRIMARY KEY,
	"role" varchar(20) DEFAULT 'student' NOT NULL,
	CONSTRAINT "user_roles_role_check" CHECK ("role" in ('student', 'teacher'))
);
--> statement-breakpoint
ALTER TABLE "app"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
REVOKE ALL ON app.user_roles FROM PUBLIC, anon, authenticated;
