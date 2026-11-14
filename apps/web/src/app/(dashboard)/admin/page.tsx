import { redirect } from "next/navigation";
import { requireAccount } from "#lib/account.server.ts";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/");
  const { tab } = await searchParams;
  redirect(tab === "consultations" ? "/admin/consultations" : "/admin/users");
}
