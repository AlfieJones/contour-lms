import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createClient } from "@supabase/supabase-js";
import { createDb } from "@lms/db";
import { expect, test } from "vitest";

import { router } from "../src/index.ts";

test("RPC client and handler round-trip public requests without a session", async () => {
  const handler = new RPCHandler(router);
  const context = {
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
});
