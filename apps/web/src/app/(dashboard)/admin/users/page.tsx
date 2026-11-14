import { redirect } from "next/navigation";
import { requireAccount } from "#lib/account.server.ts";
import { PageLayout } from "#components/page-layout.tsx";
import { UserManagement } from "./user-management";
import { serverOrpc } from "#lib/orpc.server.ts";
import { HydrateClient, prefetch } from "#lib/query-server.tsx";

export default async function AdminUsersPage() {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/");
  await prefetch(serverOrpc.admin.users.list.queryOptions({ input: { page: 1 } }));
  return (
    <HydrateClient>
      <PageLayout title="Users">
        <UserManagement />
      </PageLayout>
    </HydrateClient>
  );
}
