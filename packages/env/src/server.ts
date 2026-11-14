import { serverEnvSchema, validate } from "#index";

export const env = validate(serverEnvSchema, process.env, "server");

export type Env = typeof env;
