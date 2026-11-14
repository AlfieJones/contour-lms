import { createEnv } from "@lms/env/server";
import { z } from "zod";

export const env = createEnv({
  scope: "db",
  schema: { DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, hostname: /.+/ }) },
});
