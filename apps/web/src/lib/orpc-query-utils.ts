import type { RouterClient } from "@orpc/server";
import type { Router } from "@lms/api";
import { createTanstackQueryUtils, type RouterUtils } from "@orpc/tanstack-query";
import type { QueryKey } from "@tanstack/react-query";

export function createAppQueryUtils(client: RouterClient<Router>): RouterUtils<typeof client> {
  const utils: RouterUtils<typeof client> = createTanstackQueryUtils(client, {
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
        if (path[0] === "consultation") {
          await Promise.all([
            invalidate(utils.consultation.key()),
            invalidate(utils.admin.consultations.key()),
          ]);
        } else if (path[0] === "admin" && path[1] === "users" && path[2] === "setRole") {
          await Promise.all([
            invalidate(utils.admin.users.list.key()),
            invalidate(utils.enrolment.key()),
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
