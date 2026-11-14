import { createEnv } from "@lms/env/server";
import { z } from "zod";

export const env = createEnv({
  scope: "web",
  schema: {
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
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
});
