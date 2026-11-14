import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createTestAccounts } from "./test-accounts.ts";

const path = new URL("../.env.local", import.meta.url);
const previous = readFileSync(path, "utf8");
const patterns: string[] = JSON.parse(
  process.env.ADMIN_EMAIL_PATTERNS ?? parseEnv(previous).ADMIN_EMAIL_PATTERNS ?? "[]",
);
const { accounts, cleanup } = await createTestAccounts();
try {
  const line = `ADMIN_EMAIL_PATTERNS='${JSON.stringify([...patterns, accounts.admin.email])}'`;
  writeFileSync(
    path,
    /^ADMIN_EMAIL_PATTERNS=.*$/m.test(previous)
      ? previous.replace(/^ADMIN_EMAIL_PATTERNS=.*$/m, line)
      : `${previous}\n${line}\n`,
    { mode: 0o600 },
  );
} catch (error) {
  await cleanup();
  throw error;
}
console.log("Created verified local accounts (kept for manual testing):");
console.table(
  Object.entries(accounts).map(([role, { email, password }]) => ({ role, email, password })),
);
console.log("Admin added to apps/web/.env.local. Restart pnpm dev to apply the allowlist.");
