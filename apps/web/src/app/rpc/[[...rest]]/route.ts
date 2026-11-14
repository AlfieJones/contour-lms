import { handleRequest } from "@lms/api/handler";

import { createClient } from "#lib/supabase/server.ts";

export async function POST(request: Request) {
  return handleRequest(request, { supabase: await createClient() });
}
