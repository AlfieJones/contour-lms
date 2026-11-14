import { z } from "zod";

import { publicOS } from "#procedures";

export const healthRouter = publicOS
  .output(z.object({ status: z.literal("ok") }))
  .handler(() => ({ status: "ok" }));
