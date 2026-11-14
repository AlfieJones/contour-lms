import { z } from "zod";
import { clientVariables, validate } from "#index";

// Next.js needs explicit property reads to inline public variables into browser code.
export const env = validate(
  z.object(clientVariables),
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  "client",
);

export type ClientEnv = typeof env;
