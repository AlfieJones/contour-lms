import { createEnv } from "@lms/env";
import { z } from "zod";

export const env = createEnv({
  scope: "web:public",
  schema: {
    NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
  },
  // Next.js needs explicit property reads to inline public variables into browser code.
  values: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
});
