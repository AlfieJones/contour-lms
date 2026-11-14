import { z } from "zod";

export const clientVariables = {
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("sb_publishable_", "Must be a Supabase publishable key (sb_publishable_...)."),
};

export const serverVariables = {
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    hostname: /.+/,
    error: "Must be a Postgres URL (postgres:// or postgresql://).",
  }),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
};

export const serverEnvSchema = z.object({ ...clientVariables, ...serverVariables });

export function validate<T extends z.ZodType>(
  schema: T,
  values: unknown,
  scope: string,
): z.infer<T> {
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
