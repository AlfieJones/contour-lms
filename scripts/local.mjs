import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const command = process.argv[2];
if (command !== "setup" && command !== "test") throw new Error("Use setup or test.");

function pnpm(args, options = {}) {
  return execFileSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
    ...options,
  });
}

if (command === "setup") {
  pnpm(["emails:generate"], { stdio: "inherit" });
  console.log("Starting local Supabase...");
  pnpm(["exec", "supabase", "start"]);
}

const status = JSON.parse(pnpm(["exec", "supabase", "status", "-o", "json"]));

if (command === "setup") {
  const path = new URL("../.env.local", import.meta.url);
  const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
  const admin =
    previous.match(/^ADMIN_EMAIL_PATTERNS=.*$/m)?.[0] ??
    "ADMIN_EMAIL_PATTERNS='[\"admin@example.com\"]'";
  writeFileSync(
    path,
    [
      `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
      `DATABASE_URL=${status.DB_URL}`,
      admin,
      ...["APP_URL", "EMAIL_SMTP_URL", "EMAIL_FROM", "EMAIL_FROM_NAME"].map((key) => {
        const defaults = {
          APP_URL: "http://localhost:3000",
          EMAIL_SMTP_URL: "smtp://127.0.0.1:55325",
          EMAIL_FROM: "noreply@contour.local",
          EMAIL_FROM_NAME: "Contour",
        };
        return (
          previous.split("\n").find((line) => line.startsWith(`${key}=`)) ??
          `${key}=${defaults[key]}`
        );
      }),
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  pnpm(["db:migrate"], { stdio: "inherit" });
  console.log("Ready. Run pnpm dev.");
} else {
  pnpm(
    ["--filter", "@lms/api", "exec", "vitest", "run", "tests/consultation.integration.test.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TEST_DATABASE_URL: status.DB_URL,
        TEST_SUPABASE_URL: status.API_URL,
        TEST_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
        TEST_SUPABASE_SECRET_KEY: status.SECRET_KEY,
      },
    },
  );
}
