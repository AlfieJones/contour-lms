import type { RouterClient } from "@orpc/server";
import { z } from "zod";

import { base, sessionBase, sessionSchema } from "#context";

export { base, authenticated } from "#context";
export type { ApiContext, Session } from "#context";

export const router = {
  health: base.output(z.object({ status: z.literal("ok") })).handler(() => ({ status: "ok" })),
  session: {
    get: sessionBase.output(sessionSchema.nullable()).handler(({ context }) => context.session),
  },
};

export type ApiClient = RouterClient<typeof router>;
