import { validateDatabaseEnv, type DatabaseEnv } from "#index";

export function getDatabaseEnv(): DatabaseEnv {
  return validateDatabaseEnv({ DATABASE_URL: process.env.DATABASE_URL });
}

export type { DatabaseEnv } from "#index";
