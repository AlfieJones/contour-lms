import { serverEnvSchema, validate } from "#index";

if (typeof window !== "undefined") {
  throw new Error("Use @lms/env/client in browser code.");
}

export const env = validate(serverEnvSchema, process.env, "server");

export type Env = typeof env;
