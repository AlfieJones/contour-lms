import type { RouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { Router } from "@lms/api";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

if (import.meta.env.SSR) {
  await import("./orpc.server");
}

declare global {
  var $client: RouterClient<Router> | undefined;
}

const link = new RPCLink({
  url: "/api/rpc",
  origin: () => {
    if (typeof window === "undefined") {
      throw new Error("This link is not allowed on the server side.");
    }

    return window.location.origin;
  },
});

// Handle requests directly if on the server, otherwise use fetch to get them from our api
export const client: RouterClient<Router> = globalThis.$client ?? createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
