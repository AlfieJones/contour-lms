import { redirect } from "next/navigation";
import { requiresMfa } from "@lms/api";
import { PageLayout } from "#components/page-layout.tsx";
import { MfaChallenge } from "./mfa-challenge";
import { createSupabaseServerClient } from "#lib/supabase.server.ts";

export default async function MfaPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: claims, error: claimsError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  if (error || claimsError || !data.user || !claims?.claims) redirect("/login");
  if (!requiresMfa(data.user, claims.claims.aal)) redirect("/");
  const factors = (data.user.factors ?? [])
    .filter((factor) => factor.status === "verified" && factor.factor_type === "totp")
    .map((factor, index) => ({ id: factor.id, label: `Authenticator app ${index + 1}` }));
  return (
    <PageLayout
      variant="auth"
      title="Two-factor authentication"
      description="Enter a code from your authenticator app to continue."
    >
      <MfaChallenge factors={factors} />
    </PageLayout>
  );
}
