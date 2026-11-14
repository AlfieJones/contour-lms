import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

// CLI tools run outside Next.js. Load its local configuration explicitly.
const localEnv = new URL("../../apps/web/.env.local", import.meta.url);
if (existsSync(localEnv)) loadEnvFile(localEnv);
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL or run pnpm supabase:start.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  schemaFilter: ["app"],
  dbCredentials: { url: process.env.DATABASE_URL },
});
