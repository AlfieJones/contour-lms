import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "#lib/orpc.server.ts";
import { requiresMfa } from "@lms/api";
import { createSupabaseServerClient } from "#lib/supabase.server.ts";

export const getCurrentAccount = cache(() => serverClient.user.get());

export const requireAccount = cache(async () => {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const [{ data: userData, error }, { data: claimsData, error: claimsError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  if (error || claimsError || !userData.user || !claimsData?.claims) redirect("/login");
  if (requiresMfa(userData.user, claimsData.claims.aal)) redirect("/auth/mfa");
  return account;
});
