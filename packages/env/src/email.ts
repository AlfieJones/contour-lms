import { emailEnvSchema, validate } from "#index";

if (typeof window !== "undefined") throw new Error("Email configuration is server-only.");

export const env = validate(emailEnvSchema, process.env, "email");
