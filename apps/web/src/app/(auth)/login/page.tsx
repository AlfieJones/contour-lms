import { redirect } from "next/navigation";
import { getCurrentAccount } from "#lib/account.server.ts";
import { AuthForm } from "#components/auth-form.tsx";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const account = await getCurrentAccount();
  if (account) redirect("/");
  const { email } = await searchParams;
  return <AuthForm email={typeof email === "string" ? email : ""} />;
}
