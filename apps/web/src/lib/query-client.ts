import { RPCJsonSerializer } from "@orpc/client";
import {
  defaultShouldDehydrateQuery,
  environmentManager,
  hashKey,
  QueryClient,
} from "@tanstack/react-query";

const serializer = new RPCJsonSerializer();

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        queryKeyHashFn: (queryKey) => {
          const { json, meta } = serializer.serialize(queryKey);
          return hashKey([json, meta?.map((entry) => JSON.stringify(entry)).sort()]);
        },
      },
      dehydrate: {
        // Include in-flight prefetches so React can stream their results.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        // Next.js handles error redaction and needs its own errors for dynamic rendering.
        shouldRedactErrors: () => false,
        serializeData: (data) => serializer.serialize(data),
      },
      hydrate: {
        deserializeData: (data) => serializer.deserialize(data),
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }

  return (browserQueryClient ??= makeQueryClient());
}
