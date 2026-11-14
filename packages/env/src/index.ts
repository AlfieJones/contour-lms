import { z } from "zod";

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    hostname: /.+/,
    error: "Must be an HTTP or HTTPS URL.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .startsWith("sb_publishable_", "Must be a Supabase publishable key (sb_publishable_...).")
    .min("sb_publishable_".length + 1, "Must be a non-empty Supabase publishable key."),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    hostname: /.+/,
    error: "Must be a Postgres URL (postgres:// or postgresql://).",
  }),
});

export const envSchema = clientEnvSchema.extend(databaseEnvSchema.shape).extend({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type Env = z.infer<typeof envSchema>;

function validate<T extends z.ZodType>(schema: T, values: unknown, scope: string): z.infer<T> {
  const result = schema.safeParse(values);
  if (result.success) return result.data;

  // Report names and schema messages only: values may contain database passwords or keys.
  const issues = result.error.issues.map(
    (issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`,
  );
  const message = `[env] Invalid ${scope} environment:\n${issues.join("\n")}`;
  console.warn(message);
  throw new Error(message);
}

export function validateClientEnv(values: unknown): ClientEnv {
  return validate(clientEnvSchema, values, "client");
}

export function validateDatabaseEnv(values: unknown): DatabaseEnv {
  return validate(databaseEnvSchema, values, "database");
}

export function validateEnv(values: unknown): Env {
  return validate(envSchema, values, "server");
}
