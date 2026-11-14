import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { AuthApiError, createClient } from "@supabase/supabase-js";
import { createDb } from "@lms/db";
import { expect, test, vi } from "vitest";

import { router } from "../src/index.ts";

function createTestContext() {
  return {
    db: createDb("postgresql://postgres:postgres@127.0.0.1:55322/postgres"),
    supabase: createClient("http://127.0.0.1:55321", "sb_publishable_test_key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: () => {
          throw new Error("Public requests must not contact Supabase without a session.");
        },
      },
    }),
  };
}

test("RPC client and handler round-trip public requests without a session", async () => {
  const handler = new RPCHandler(router);
  const context = createTestContext();
  const client: RouterClient<typeof router> = createORPCClient(
    new RPCLink({
      origin: "http://localhost",
      url: "/rpc",
      fetch: async (url, init) => {
        const result = await handler.handle(new Request(url, init), { prefix: "/rpc", context });
        expect(result.matched).toBe(true);
        return result.response ?? new Response(null, { status: 404 });
      },
    }),
  );

  await expect(client.health()).resolves.toEqual({ status: "ok" });
  await expect(client.user.get()).resolves.toBeNull();
  await expect(client.user.logout()).resolves.toBeUndefined();
});

test("logout ends only the current session", async () => {
  const context = createTestContext();
  const signOut = vi.spyOn(context.supabase.auth, "signOut").mockResolvedValue({ error: null });
  const client = createRouterClient(router, { context });

  await expect(client.user.logout()).resolves.toBeUndefined();
  expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
});

test("logout reports a failure so the account menu can offer a retry", async () => {
  const context = createTestContext();
  vi.spyOn(context.supabase.auth, "signOut").mockResolvedValue({
    error: new AuthApiError("Sign out failed", 500, "unexpected_failure"),
  });
  const client = createRouterClient(router, { context });

  await expect(client.user.logout()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
