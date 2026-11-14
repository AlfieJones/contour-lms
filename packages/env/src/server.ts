import { validateEnv } from "#index";

if (typeof window !== "undefined") {
  throw new Error("Use @lms/env/client in browser code.");
}

export const env = validateEnv(process.env);

export type { Env } from "#index";
