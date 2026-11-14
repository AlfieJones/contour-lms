import { afterEach, expect, expectTypeOf, test, vi } from "vitest";

import {
  clientEnvSchema,
  databaseEnvSchema,
  validateClientEnv,
  validateDatabaseEnv,
  validateEnv,
  type ClientEnv,
  type Env,
} from "../src/index.ts";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  DATABASE_URL: "postgresql://postgres:local-test-password@127.0.0.1:55322/postgres",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("validated env has schema-inferred types and strips unrelated OS variables", () => {
  const env = validateEnv({ ...valid, PATH: "/usr/bin" });
  expect(env).toEqual({ ...valid, NODE_ENV: "development" });
  expectTypeOf(env).toEqualTypeOf<Env>();
  expectTypeOf(env.DATABASE_URL).toEqualTypeOf<string>();
  expectTypeOf(env.NODE_ENV).toEqualTypeOf<"development" | "production" | "test">();
});

test("client validation needs only public variables and excludes private values", () => {
  const env = validateClientEnv(valid);
  expect(env).toEqual({
    NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  expectTypeOf(env).toEqualTypeOf<ClientEnv>();
  expectTypeOf<ClientEnv>().not.toHaveProperty("DATABASE_URL");
});

test("database validation works without web or auth variables", async () => {
  vi.stubEnv("DATABASE_URL", valid.DATABASE_URL);
  const { getDatabaseEnv } = await import("../src/database.ts");
  expect(getDatabaseEnv()).toEqual({ DATABASE_URL: valid.DATABASE_URL });
});

test("missing variables produce a warning listing every required field", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(() => validateEnv({})).toThrow("Invalid server environment");
  expect(warn).toHaveBeenCalledOnce();
  const message = String(warn.mock.calls[0]?.[0]);
  expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
  expect(message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(message).toContain("DATABASE_URL");
});

test("malformed configuration warns and throws without exposing credentials", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const secret = "super-private-database-password";
  const values = {
    ...valid,
    DATABASE_URL: `https://postgres:${secret}@example.com/postgres`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private-key",
    NODE_ENV: "staging",
  };
  expect(() => validateEnv(values)).toThrow("Invalid server environment");
  const message = String(warn.mock.calls[0]?.[0]);
  expect(message).toContain("DATABASE_URL");
  expect(message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(message).toContain("NODE_ENV");
  expect(message).not.toContain(secret);
  expect(message).not.toContain("sb_secret_private-key");
  expect(() => validateEnv(values)).not.toThrow(secret);
});

test.each(["ftp://example.com", "not-a-url", "", "http://"])(
  "rejects invalid Supabase URL %s",
  (url) => {
    expect(clientEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url }).success).toBe(
      false,
    );
  },
);

test.each([
  "postgres://postgres:password@localhost/app",
  "postgresql://postgres:password@db.example.com/app",
])("accepts Postgres connection URL %s", (url) => {
  expect(validateDatabaseEnv({ DATABASE_URL: url })).toEqual({ DATABASE_URL: url });
});

test.each(["https://db.example.com", "postgres:password", "", "not-a-url"])(
  "rejects invalid database URL %s",
  (url) => {
    expect(databaseEnvSchema.safeParse({ DATABASE_URL: url }).success).toBe(false);
  },
);

test("server exports validate on import", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", valid.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  vi.stubEnv("DATABASE_URL", valid.DATABASE_URL);
  vi.stubEnv("NODE_ENV", "test");
  const { env } = await import("../src/server.ts");
  expect(env).toEqual({ ...valid, NODE_ENV: "test" });
});

test("client exports do not require a database URL", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", valid.NEXT_PUBLIC_SUPABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  vi.stubEnv("DATABASE_URL", undefined);
  const { env } = await import("../src/client.ts");
  expect(env).not.toHaveProperty("DATABASE_URL");
});
