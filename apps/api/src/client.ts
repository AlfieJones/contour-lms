import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

import type { ApiClient } from "#index";

export function createApiClient(origin?: string): ApiClient {
  return createORPCClient(new RPCLink({ url: "/rpc", origin }));
}
