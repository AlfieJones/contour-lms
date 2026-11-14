// Supabase owns auth.users. Use this mapping for server-side queries and foreign keys;
// keep it out of schema.ts so Drizzle Kit only migrates application tables.
export { authUsers } from "drizzle-orm/supabase";
