import { createEnv as parseEnvironment, type EnvFields, type EnvOptions } from "#index";

if ("window" in globalThis) {
  throw new Error("Use @lms/env with explicit public values in browser code.");
}

export function createEnv<const T extends EnvFields>(options: EnvOptions<T>) {
  return parseEnvironment({ ...options, values: process.env });
}
