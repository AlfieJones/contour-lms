import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@lms/db";

export interface ApiContext {
  supabase: SupabaseClient;
  db: Database;
}
