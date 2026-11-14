import assert from "node:assert/strict";
import { test } from "node:test";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@lms/api";
import { createORPCClient, ORPCError } from "@orpc/client";
import { dehydrate, environmentManager, hydrate } from "@tanstack/react-query";
import { createAppQueryUtils } from "../src/lib/orpc-query-utils.ts";
import { makeQueryClient } from "../src/lib/query-client.ts";

function mockClient(handler: (path: readonly string[], input: unknown) => Promise<unknown>) {
  return createORPCClient<RouterClient<Router>>({ call: handler });
}

await test("server-prefetched data hydrates with Dates and satisfies browser queries without refetching", async () => {
  const data = {
    items: [{ id: "consultation", scheduledAt: new Date("2030-06-01T04:00:00Z") }],
    hasMore: false,
  };
  let serverCalls = 0;
  let browserCalls = 0;
  const server = createAppQueryUtils(
    mockClient(async () => {
      serverCalls++;
      return data;
    }),
  );
  const browser = createAppQueryUtils(
    mockClient(async () => {
      browserCalls++;
      throw new Error("Unexpected browser fetch");
    }),
  );
  const serverCache = makeQueryClient();
  const browserCache = makeQueryClient();
  const options = server.consultation.list.queryOptions({ input: { page: 1 } });

  await Promise.all([serverCache.query(options), serverCache.query(options)]);
  hydrate(browserCache, JSON.parse(JSON.stringify(dehydrate(serverCache))));
  const restored = await browserCache.query(
    browser.consultation.list.queryOptions({ input: { page: 1 } }),
  );

  assert.deepEqual(restored, data);
  assert.ok(restored.items[0]?.scheduledAt instanceof Date);
  assert.equal(serverCalls, 1);
  assert.equal(browserCalls, 0);
  assert.equal(makeQueryClient().getQueryCache().getAll().length, 0);
});

await test("pending prefetch results survive hydration", async () => {
  const deferred = Promise.withResolvers<unknown>();
  const utils = createAppQueryUtils(mockClient(() => deferred.promise));
  const serverCache = makeQueryClient();
  const browserCache = makeQueryClient();
  const options = utils.admin.users.list.queryOptions({ input: { page: 1 } });
  const pending = serverCache.query(options);
  const dehydrated = dehydrate(serverCache);
  assert.equal(dehydrated.queries[0]?.state.status, "pending");
  hydrate(browserCache, dehydrated);
  deferred.resolve({ items: [], hasMore: false });
  await pending;
  const result = await browserCache.query(options);
  assert.equal(result.hasMore, false);
  assert.equal(result.items.length, 0);
});

await test("consultation mutations invalidate all member and admin pages while preserving unrelated caches", async () => {
  const utils = createAppQueryUtils(mockClient(async () => ({ id: "changed" })));
  const cache = makeQueryClient();
  const keys = [
    utils.consultation.list.queryKey({ input: { page: 1 } }),
    utils.consultation.list.queryKey({ input: { page: 2 } }),
    utils.admin.consultations.queryKey({ input: { page: 1 } }),
    utils.admin.consultations.queryKey({ input: { page: 2 } }),
  ];
  const usersKey = utils.admin.users.list.queryKey({ input: { page: 1 } });
  const seed = () => {
    for (const key of [...keys, usersKey]) cache.setQueryData(key, { items: [], hasMore: false });
  };
  for (const options of [
    utils.consultation.cancel.mutationOptions(),
    utils.consultation.setComplete.mutationOptions(),
    utils.consultation.reschedule.mutationOptions(),
    utils.consultation.create.mutationOptions(),
    utils.consultation.createForStudent.mutationOptions(),
  ]) {
    seed();
    // Exercise each generated mutation function with the same QueryClient context as useMutation.
    assert.ok(options.mutationFn);
    await options.mutationFn(
      {
        id: "changed",
        complete: true,
        firstName: "Test",
        lastName: "Student",
        reason: "Test",
        teacherId: "teacher",
        enrolmentId: "enrolment",
        scheduledAt: "2030-06-01T04:00:00Z",
      },
      { client: cache, meta: undefined },
    );
    for (const key of keys) assert.equal(cache.getQueryState(key)?.isInvalidated, true);
    assert.equal(cache.getQueryState(usersKey)?.isInvalidated, false);
  }
});

await test("role changes invalidate every user page and failed mutations leave cache intact", async () => {
  let fail = false;
  const utils = createAppQueryUtils(
    mockClient(async () => {
      if (fail) throw new ORPCError("FORBIDDEN");
      return { userId: "user", role: "teacher" };
    }),
  );
  const cache = makeQueryClient();
  const keys = [1, 2].map((page) => utils.admin.users.list.queryKey({ input: { page } }));
  for (const key of keys) cache.setQueryData(key, { items: [], hasMore: false });
  const mutation = cache
    .getMutationCache()
    .build(cache, utils.admin.users.setRole.mutationOptions());
  await mutation.execute({ userId: "user", role: "teacher" });
  for (const key of keys) assert.equal(cache.getQueryState(key)?.isInvalidated, true);

  for (const key of keys) cache.setQueryData(key, { items: [], hasMore: false });
  fail = true;
  await assert.rejects(
    cache
      .getMutationCache()
      .build(cache, utils.admin.users.setRole.mutationOptions())
      .execute({ userId: "user", role: "student" }),
  );
  for (const key of keys) assert.equal(cache.getQueryState(key)?.isInvalidated, false);
});

await test("query retries exclude auth and validation failures and never delay server rendering", () => {
  const cache = makeQueryClient();
  const retry = cache.getDefaultOptions().queries?.retry;
  assert.equal(typeof retry, "function");
  if (typeof retry !== "function") return;
  assert.equal(retry(0, new Error("Network failure")), false);
  environmentManager.setIsServer(() => false);
  try {
    for (const code of ["UNAUTHORIZED", "FORBIDDEN", "BAD_REQUEST", "NOT_FOUND"]) {
      assert.equal(retry(0, new ORPCError(code)), false);
    }
    assert.equal(retry(0, new Error("Network failure")), true);
    assert.equal(retry(1, new ORPCError("INTERNAL_SERVER_ERROR")), true);
    assert.equal(retry(2, new Error("Network failure")), false);
  } finally {
    environmentManager.setIsServer(() => true);
    cache.clear();
  }
});

await test("enrolments and role changes invalidate teacher choices and every student page", async () => {
  const utils = createAppQueryUtils(mockClient(async () => ({ emailSent: true })));
  const cache = makeQueryClient();
  const keys = [
    utils.enrolment.teachers.queryKey(),
    utils.enrolment.students.queryKey({ input: { page: 1 } }),
    utils.enrolment.students.queryKey({ input: { page: 2 } }),
  ];
  const unrelated = utils.consultation.list.queryKey({ input: { page: 1 } });
  try {
    for (const mutate of [
      () =>
        cache
          .getMutationCache()
          .build(cache, utils.enrolment.enrol.mutationOptions())
          .execute({ email: "student@example.com" }),
      () =>
        cache
          .getMutationCache()
          .build(cache, utils.admin.users.setRole.mutationOptions())
          .execute({ userId: "teacher", role: "student" }),
    ]) {
      for (const key of [...keys, unrelated]) cache.setQueryData(key, []);
      await mutate();
      for (const key of keys) assert.equal(cache.getQueryState(key)?.isInvalidated, true);
      assert.equal(cache.getQueryState(unrelated)?.isInvalidated, false);
    }
    for (const key of keys) cache.setQueryData(key, []);
    await cache
      .getMutationCache()
      .build(cache, utils.enrolment.resend.mutationOptions())
      .execute({ id: "enrolment" });
    for (const key of keys) assert.equal(cache.getQueryState(key)?.isInvalidated, false);
  } finally {
    cache.clear();
  }
});

await test("a pre-mutation next-page fetch cannot restore stale data after invalidation", async () => {
  const deferred = Promise.withResolvers<unknown>();
  const started = Promise.withResolvers<void>();
  const utils = createAppQueryUtils(
    mockClient(async (path) => {
      if (path[1] === "list") {
        started.resolve();
        return deferred.promise;
      }
      return { id: "cancelled" };
    }),
  );
  const cache = makeQueryClient();
  const options = utils.consultation.list.queryOptions({ input: { page: 2 } });
  const previous = { items: [], hasMore: true };
  cache.setQueryData(options.queryKey, previous);
  try {
    const pending = cache.query({ ...options, staleTime: 0 }).catch(() => undefined);
    await started.promise;
    await cache
      .getMutationCache()
      .build(cache, utils.consultation.cancel.mutationOptions())
      .execute({ id: "cancelled" });
    deferred.resolve({ items: [{ id: "stale" }], hasMore: false });
    await pending;
    assert.deepEqual(cache.getQueryData(options.queryKey), previous);
    assert.equal(cache.getQueryState(options.queryKey)?.isInvalidated, true);
    assert.equal(cache.getQueryState(options.queryKey)?.fetchStatus, "idle");
  } finally {
    deferred.resolve(previous);
    cache.clear();
  }
});
