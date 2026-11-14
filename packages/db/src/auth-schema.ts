// Supabase owns auth.users. Use this mapping for server-side queries and foreign keys;
// keep it out of schema.ts so Drizzle Kit only migrates application tables.
import { jsonb, pgSchema, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const authUsers = pgSchema("auth").table("users", {
  id: uuid().primaryKey().notNull(),
  email: varchar({ length: 255 }),
  phone: text().unique(),
  emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
  phoneConfirmedAt: timestamp("phone_confirmed_at", { withTimezone: true }),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  rawUserMetaData: jsonb("raw_user_meta_data").$type<Record<string, unknown>>(),
});
