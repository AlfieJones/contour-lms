import type { User } from "@supabase/supabase-js";
import { expect, test } from "vitest";
import { resolveAccount } from "../src/account.ts";

const user = {
  id: "student-id",
  email: "Admin@Example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  user_metadata: { role: "admin" },
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} satisfies User;

test("only verified emails grant access; user-editable metadata cannot promote a student", () => {
  expect(resolveAccount(user, [])?.role).toBe("student");
  expect(resolveAccount({ ...user, email_confirmed_at: undefined }, ["*@example.com"])).toBeNull();
  expect(resolveAccount({ ...user, is_anonymous: true }, ["*@example.com"])).toBeNull();
});

test("admin patterns match an exact email or a whole domain", () => {
  expect(resolveAccount(user, ["admin@example.com"])?.role).toBe("admin");
  expect(resolveAccount(user, ["*@example.com"])?.role).toBe("admin");
  expect(
    resolveAccount({ ...user, email: "admin@evil-example.com" }, ["*@example.com"])?.role,
  ).toBe("student");
  expect(resolveAccount({ ...user, email: "admin@sub.example.com" }, ["*@example.com"])?.role).toBe(
    "student",
  );
});

test("stored teacher roles apply without overriding the admin allowlist", () => {
  expect(resolveAccount(user, [], "teacher")?.role).toBe("teacher");
  expect(resolveAccount(user, ["admin@example.com"], "teacher")?.role).toBe("admin");
});

test("account names use the signup name and handle missing or invalid metadata", () => {
  expect(
    resolveAccount({ ...user, user_metadata: { full_name: "  Alfie Jones  " } }, [])?.name,
  ).toBe("Alfie Jones");
  for (const full_name of [undefined, null, "", "  ", 123, {}]) {
    expect(resolveAccount({ ...user, user_metadata: { full_name } }, [])?.name).toBeNull();
  }
});
