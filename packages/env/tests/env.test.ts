import { afterEach, expect, expectTypeOf, test, vi } from "vitest";

import type { ClientEnv } from "../src/client.ts";
import type { Env } from "../src/server.ts";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  DATABASE_URL: "postgresql://postgres:local-test-password@127.0.0.1:55322/postgres",
};

function stubEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("server validates the existing environment and combines client and server variables", async () => {
  stubEnv({ ...valid, NODE_ENV: "production" });

  const { env } = await import("../src/server.ts");
  expect(env).toEqual({ ...valid, NODE_ENV: "production" });
  expectTypeOf(env).toEqualTypeOf<Env>();
  expectTypeOf(env.DATABASE_URL).toEqualTypeOf<string>();
  expectTypeOf(env.NODE_ENV).toEqualTypeOf<"development" | "production" | "test">();
  expect(env).not.toHaveProperty("PATH");
});

test("server defaults to development when NODE_ENV is unset", async () => {
  stubEnv({ ...valid, NODE_ENV: undefined });
  const { env } = await import("../src/server.ts");
  expect(env.NODE_ENV).toBe("development");
});

test("client validates only public variables", async () => {
  stubEnv({ ...valid, DATABASE_URL: undefined });
  const { env } = await import("../src/client.ts");
  expect(env).toEqual({
    NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  expectTypeOf(env).toEqualTypeOf<ClientEnv>();
  expectTypeOf<ClientEnv>().not.toHaveProperty("DATABASE_URL");
});

test("missing variables fail on import and list every required field", async () => {
  stubEnv({
    NEXT_PUBLIC_SUPABASE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined,
    DATABASE_URL: undefined,
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(import("../src/server.ts")).rejects.toThrow("Invalid server environment");
  expect(warn).toHaveBeenCalledOnce();
  const message = String(warn.mock.calls[0]?.[0]);
  expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
  expect(message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(message).toContain("DATABASE_URL");
});

test("malformed configuration fails without exposing credentials", async () => {
  const secret = "super-private-database-password";
  stubEnv({
    ...valid,
    DATABASE_URL: `https://postgres:${secret}@example.com/postgres`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private-key",
    NODE_ENV: "staging",
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(import("../src/server.ts")).rejects.toThrow("Invalid server environment");
  const message = String(warn.mock.calls[0]?.[0]);
  expect(message).toContain("DATABASE_URL");
  expect(message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(message).toContain("NODE_ENV");
  expect(message).not.toContain(secret);
  expect(message).not.toContain("sb_secret_private-key");
});

test.each(["ftp://example.com", "not-a-url", "", "http://"])(
  "rejects invalid public URL %s on client import",
  async (url) => {
    stubEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(import("../src/client.ts")).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
  },
);

test.each([
  "postgres://postgres:password@localhost/app",
  "postgresql://postgres:password@db.example.com/app",
])("accepts Postgres connection URL %s", async (url) => {
  stubEnv({ ...valid, DATABASE_URL: url });
  const { env } = await import("../src/server.ts");
  expect(env.DATABASE_URL).toBe(url);
});

test.each(["https://db.example.com", "postgres:password", "", "not-a-url"])(
  "rejects invalid database URL %s on server import",
  async (url) => {
    stubEnv({ ...valid, DATABASE_URL: url });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(import("../src/server.ts")).rejects.toThrow("DATABASE_URL");
  },
);

test("server import rejects browser usage", async () => {
  vi.stubGlobal("window", {});
  await expect(import("../src/server.ts")).rejects.toThrow("Use @lms/env/client in browser code.");
});
