import { validateClientEnv } from "#index";

// Next.js needs explicit property reads to inline public variables into browser code.
export const env = validateClientEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export type { ClientEnv } from "#index";
