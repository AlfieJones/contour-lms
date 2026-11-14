import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "#lib/supabase.server.ts";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = request.nextUrl.searchParams.get("next");
      // Only allow known destinations; callback URLs must never be open redirects.
      return NextResponse.redirect(
        new URL(next === "/settings/security" ? next : "/", request.url),
      );
    }
  }
  return NextResponse.redirect(new URL("/auth/error", request.url));
}
