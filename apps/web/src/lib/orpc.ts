import type { RouterClient } from "@orpc/server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { Router } from "@lms/api";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

const link = new RPCLink({
  url: "/api/rpc",
  origin: () => {
    if (typeof window === "undefined") {
      throw new Error("This link is not allowed on the server side.");
    }

    return window.location.origin;
  },
});

// Server Components import serverClient from orpc.server.ts directly.
export const client: RouterClient<Router> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
