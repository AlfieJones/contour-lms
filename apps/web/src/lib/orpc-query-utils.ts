import type { RouterClient } from "@orpc/server";
import type { Router } from "@lms/api";
import { createTanstackQueryUtils, type RouterUtils } from "@orpc/tanstack-query";
import type { QueryKey } from "@tanstack/react-query";

type ConsultationPage = Awaited<ReturnType<RouterClient<Router>["consultation"]["list"]>>;

export function createAppQueryUtils(client: RouterClient<Router>): RouterUtils<typeof client> {
  const utils: RouterUtils<typeof client> = createTanstackQueryUtils(client, {
    scoped: {
      consultation: {
        setComplete: {
          mutationInterceptors: [
            async (options) => {
              const { input, fnContext } = options;
              const cache = fnContext.client;
              const keys = [utils.consultation.list.key(), utils.admin.consultations.key()];
              // Cancel stale responses before snapshotting and changing every cached list page.
              await Promise.all(keys.map((queryKey) => cache.cancelQueries({ queryKey })));
              const previous = keys.flatMap((queryKey) =>
                cache.getQueriesData<ConsultationPage>({ queryKey }),
              );
              for (const queryKey of keys) {
                cache.setQueriesData<ConsultationPage>({ queryKey }, (page) =>
                  page
                    ? {
                        ...page,
                        items: page.items.map((item) =>
                          item.id === input.id
                            ? { ...item, status: input.complete ? "completed" : "scheduled" }
                            : item,
                        ),
                      }
                    : page,
                );
              }
              try {
                // The shared interceptor below invalidates and refetches on success.
                return await options.next();
              } catch (error) {
                for (const [queryKey, page] of previous) cache.setQueryData(queryKey, page);
                await Promise.all(keys.map((queryKey) => cache.invalidateQueries({ queryKey })));
                throw error;
              }
            },
          ],
        },
      },
    },
    mutationInterceptors: [
      async (options) => {
        const { path, fnContext } = options;
        const result = await options.next();
        const invalidate = async (queryKey: QueryKey) => {
          // Stop pre-mutation prefetches from later overwriting the invalidated cache.
          await fnContext.client.cancelQueries({ queryKey });
          await fnContext.client.invalidateQueries({ queryKey });
        };

        // Mark every cached page stale; only mounted queries refetch immediately.
        if (path[0] === "user" && path[1] === "update") {
          await Promise.all([
            invalidate(utils.user.get.key()),
            invalidate(utils.enrolment.key()),
            invalidate(utils.admin.users.list.key()),
          ]);
        } else if (path[0] === "consultation") {
          await Promise.all([
            invalidate(utils.consultation.key()),
            invalidate(utils.admin.consultations.key()),
          ]);
        } else if (path[0] === "admin" && path[1] === "users" && path[2] === "setRole") {
          await Promise.all([
            invalidate(utils.admin.users.list.key()),
            invalidate(utils.enrolment.key()),
          ]);
        } else if (path[0] === "enrolment" && path[1] === "unenrol") {
          await Promise.all([
            invalidate(utils.enrolment.key()),
            invalidate(utils.consultation.key()),
            invalidate(utils.admin.consultations.key()),
          ]);
        } else if (path[0] === "enrolment" && path[1] === "enrol") {
          await invalidate(utils.enrolment.key());
        }

        return result;
      },
    ],
  });

  return utils;
}
