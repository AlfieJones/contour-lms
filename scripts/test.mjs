import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const command = process.argv[2];
if (!["e2e", "accounts", "integration"].includes(command)) {
  throw new Error("Use e2e, accounts or integration.");
}
const status = JSON.parse(
  execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  }),
);
const env = {
  ...process.env,
  TEST_DATABASE_URL: status.DB_URL,
  TEST_SUPABASE_URL: status.API_URL,
  TEST_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  TEST_SUPABASE_SECRET_KEY: status.SECRET_KEY,
};
const args =
  command === "e2e"
    ? ["playwright", "test", ...process.argv.slice(3)]
    : command === "integration"
      ? ["vitest", "run", "testing/consultation.integration.test.ts"]
      : ["node", "--conditions=development", "testing/create-accounts.ts"];
execFileSync("pnpm", ["--filter", "@lms/web", "exec", ...args], {
  cwd,
  stdio: "inherit",
  env: {
    ...env,
    DATABASE_URL: status.DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    // Only the dedicated test server grants access to generated admin emails.
    ...(command === "e2e"
      ? {
          ADMIN_EMAIL_PATTERNS: '["*@e2e-admin.example.com"]',
          PLAYWRIGHT_TEST: "1",
        }
      : {}),
  },
});
