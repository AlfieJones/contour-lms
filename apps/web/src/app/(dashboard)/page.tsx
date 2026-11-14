import { requireAccount } from "#lib/account.server.ts";
import { ConsultationDashboard } from "#components/consultation-dashboard.tsx";
import { serverOrpc } from "#lib/orpc.server.ts";
import { HydrateClient, prefetch } from "#lib/query-server.tsx";

export default async function OverviewPage() {
  const account = await requireAccount();
  await Promise.all([
    prefetch(serverOrpc.consultation.list.queryOptions({ input: { page: 1 } })),
    account.role === "student" ? prefetch(serverOrpc.enrolment.teachers.queryOptions()) : undefined,
  ]);
  return (
    <HydrateClient>
      <ConsultationDashboard account={account} />
    </HydrateClient>
  );
}
