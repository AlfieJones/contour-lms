import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "#schema";
import { relations } from "#relations";

export function createDb(url: string) {
  const client = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle({ client, relations });
}

export type Database = ReturnType<typeof createDb>;

let database: Database | undefined;

export function getDb(url: string): Database {
  if (!database) {
    database = createDb(url);
  }

  return database;
}

export { schema };
export { relations };
export { and, asc, eq, ne, sql, getTableColumns } from "drizzle-orm";
export { alias } from "drizzle-orm/pg-core";
