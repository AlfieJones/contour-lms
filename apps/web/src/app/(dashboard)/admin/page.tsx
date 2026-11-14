import { redirect } from "next/navigation";
import { requireAccount } from "#lib/account.server.ts";
import { AdminDashboard } from "#components/admin-dashboard.tsx";
import { serverOrpc } from "#lib/orpc.server.ts";
import { HydrateClient, prefetch } from "#lib/query-server.tsx";

export default async function AdminPage() {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/");
  await Promise.all([
    prefetch(serverOrpc.admin.users.list.queryOptions({ input: { page: 1 } })),
    prefetch(serverOrpc.admin.consultations.queryOptions({ input: { page: 1 } })),
  ]);
  return (
    <HydrateClient>
      <AdminDashboard account={account} />
    </HydrateClient>
  );
}
