import { getDatabaseEnv } from "@lms/env/database";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "#schema";

export function createDb(url: string) {
  const client = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle({ client });
}

export type Database = ReturnType<typeof createDb>;

let database: Database | undefined;

export function getDb(): Database {
  if (!database) {
    database = createDb(getDatabaseEnv().DATABASE_URL);
  }

  return database;
}

export { schema };
export { eq, sql } from "drizzle-orm";
