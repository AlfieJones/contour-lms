import { redirect } from "next/navigation";
import { requireAccount } from "#lib/account.server.ts";

export default async function AdminUsersPage() {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/");
  redirect("/admin?tab=users");
}
