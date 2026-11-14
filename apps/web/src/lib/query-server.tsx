import "server-only";

import type { InfiniteOptionsOut, QueryOptionsOut } from "@orpc/tanstack-query";
import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";
import { cache } from "react";
import type { ReactNode } from "react";

import { makeQueryClient } from "#lib/query-client.ts";

export const getQueryClient = cache(makeQueryClient);

export function HydrateClient({ children }: { children: ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{children}</HydrationBoundary>;
}

export async function prefetch<TOutput, TError, TSelectData, TPageParam>(
  options:
    | QueryOptionsOut<TOutput, TError, TSelectData, undefined>
    | InfiniteOptionsOut<TOutput, TError, TSelectData, TPageParam, undefined>,
): Promise<void> {
  const queryClient = getQueryClient();

  if ("initialPageParam" in options) {
    await queryClient.infiniteQuery(options).catch(noop);
  } else {
    await queryClient.query(options).catch(noop);
  }
}
