-- Keep the application schema private and grant only the runtime permissions it needs.
REVOKE ALL ON SCHEMA app FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON app.consultations FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lms_app') THEN
    CREATE ROLE lms_app NOLOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO lms_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON app.consultations TO lms_app;
