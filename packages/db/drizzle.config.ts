import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  schemaFilter: ["app"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
