import { ORPCError, RPCJsonSerializer } from "@orpc/client";
import { createHydrationOptions } from "@orpc/tanstack-query";
import {
  defaultShouldDehydrateQuery,
  environmentManager,
  QueryClient,
} from "@tanstack/react-query";

const serializer = new RPCJsonSerializer();
const permanentErrorCodes = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "CONFLICT",
  "UNPROCESSABLE_CONTENT",
]);

export function makeQueryClient() {
  const hydration = createHydrationOptions(serializer);
  return new QueryClient({
    defaultOptions: {
      ...hydration,
      queries: {
        staleTime: 60 * 1000,
        // oRPC already serializes query keys. Retry only transient client-side failures.
        retry: (failureCount, error) =>
          !environmentManager.isServer() &&
          failureCount < 2 &&
          !(error instanceof ORPCError && permanentErrorCodes.has(error.code)),
      },
      dehydrate: {
        ...hydration.dehydrate,
        // Include in-flight prefetches so React can stream their results.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        // Next.js handles error redaction and needs its own errors for dynamic rendering.
        shouldRedactErrors: () => false,
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
