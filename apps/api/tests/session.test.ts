import { call } from "@orpc/server";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  createClient,
  type User,
} from "@supabase/supabase-js";
import { createDb } from "@lms/db";
import { afterEach, expect, test, vi } from "vitest";

import { authenticated, router } from "../src/index.ts";

function setup() {
  const supabase = createClient("http://127.0.0.1:55321", "test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const db = createDb("postgresql://postgres:postgres@127.0.0.1:55322/postgres");
  return { context: { supabase, db }, getUser: vi.spyOn(supabase.auth, "getUser") };
}

const user: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "test@example.com",
  aud: "authenticated",
  created_at: "2026-10-08T00:00:00Z",
  app_metadata: { role: "member" },
  user_metadata: { privateValue: "must not be returned" },
};

afterEach(() => vi.restoreAllMocks());

test("session.get returns null without a session", async () => {
  const { context, getUser } = setup();
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
  await expect(call(router.session.get, undefined, { context })).resolves.toBeNull();
});

test("session.get returns only verified public user fields", async () => {
  const { context, getUser } = setup();
  getUser.mockResolvedValue({ data: { user }, error: null });
  await expect(call(router.session.get, undefined, { context })).resolves.toEqual({
    user: { id: user.id, email: user.email },
  });
  expect(getUser).toHaveBeenCalledOnce();
});

test("invalid tokens cannot create a session", async () => {
  const { context, getUser } = setup();
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthApiError("Invalid JWT", 403, "bad_jwt"),
  });
  await expect(call(router.session.get, undefined, { context })).resolves.toBeNull();
});

test("auth outages are errors rather than signed-out results", async () => {
  const { context, getUser } = setup();
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthRetryableFetchError("Unavailable", 503),
  });
  await expect(call(router.session.get, undefined, { context })).rejects.toMatchObject({
    code: "SERVICE_UNAVAILABLE",
  });
});

test("protected procedures reject guests", async () => {
  const { context, getUser } = setup();
  getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() });
  const procedure = authenticated.handler(({ context: requestContext }) => requestContext.user.id);
  await expect(call(procedure, undefined, { context })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
});

test("protected procedures receive the verified user and database", async () => {
  const { context, getUser } = setup();
  getUser.mockResolvedValue({ data: { user }, error: null });
  const procedure = authenticated.handler(({ context: requestContext }) => ({
    id: requestContext.user.id,
    sameDb: requestContext.db === context.db,
  }));
  await expect(call(procedure, undefined, { context })).resolves.toEqual({
    id: user.id,
    sameDb: true,
  });
});
