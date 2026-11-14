import nextEnv from "@next/env";
import { getDatabaseEnv } from "@lms/env/database";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";

nextEnv.loadEnvConfig(
  fileURLToPath(new URL("../../", import.meta.url)),
  process.env.NODE_ENV !== "production",
);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  schemaFilter: ["public"],
  dbCredentials: { url: getDatabaseEnv().DATABASE_URL },
});
