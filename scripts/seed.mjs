import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const status = JSON.parse(
  execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  }),
);
const settings = parseEnv(readFileSync(new URL("../apps/web/.env.local", import.meta.url), "utf8"));
const patterns = JSON.parse(
  process.env.ADMIN_EMAIL_PATTERNS ?? settings.ADMIN_EMAIL_PATTERNS ?? "[]",
);
const isAdmin = (email) =>
  patterns.some((pattern) =>
    pattern.trim().toLowerCase().startsWith("*@")
      ? email.endsWith(pattern.trim().toLowerCase().slice(1))
      : email === pattern.trim().toLowerCase(),
  );
if (
  !isAdmin("admin@example.com") ||
  ["teacher@example.com", "student@example.com", "student2@example.com"].some(isAdmin)
) {
  throw new Error('Include only the demo admin in ADMIN_EMAIL_PATTERNS: ["admin@example.com"].');
}

execFileSync("pnpm", ["--filter", "@lms/db", "seed"], {
  cwd,
  stdio: "inherit",
  env: {
    ...process.env,
    SEED_DATABASE_URL: status.DB_URL,
    SEED_SUPABASE_URL: status.API_URL,
    SEED_SUPABASE_SECRET_KEY: status.SECRET_KEY,
  },
});
