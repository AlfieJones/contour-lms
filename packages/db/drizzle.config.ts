import { serverEnvSchema, validate } from "@lms/env";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
const env = validate(serverEnvSchema, process.env, "server");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  schemaFilter: ["public"],
  dbCredentials: { url: env.DATABASE_URL },
});
