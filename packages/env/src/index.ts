import { z } from "zod";

export const clientVariables = {
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("sb_publishable_", "Must be a Supabase publishable key (sb_publishable_...)."),
};

// Separate schema keeps email tools independent of database configuration.
export const emailEnvSchema = z.object({
  APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
  EMAIL_SMTP_URL: z.url({ protocol: /^smtps?$/ }).default("smtp://127.0.0.1:55325"),
  EMAIL_FROM: z.email().default("noreply@contour.local"),
  EMAIL_FROM_NAME: z.string().trim().min(1).default("Contour"),
});

export const serverVariables = {
  ADMIN_EMAIL_PATTERNS: z
    .string()
    .default("[]")
    .transform((value, context) => {
      try {
        return z
          .array(
            z
              .string()
              .trim()
              .toLowerCase()
              .refine(
                (pattern) =>
                  z.email().safeParse(pattern.replace(/^\*@/, "staff@")).success &&
                  !pattern.replace(/^\*@/, "").includes("*"),
                "Use an email address or *@example.com.",
              ),
          )
          .parse(JSON.parse(value));
      } catch {
        context.addIssue({
          code: "custom",
          message: "Must be a JSON array of emails or *@domain patterns.",
        });
        return z.NEVER;
      }
    }),
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
