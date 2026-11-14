import { redirect } from "next/navigation";
import { requireAccount } from "#lib/account.server.ts";
import { ConsultationDashboard } from "#components/consultation-dashboard.tsx";
import { serverOrpc } from "#lib/orpc.server.ts";
import { HydrateClient, prefetch } from "#lib/query-server.tsx";

export default async function AdminConsultationsPage() {
  const account = await requireAccount();
  if (account.role !== "admin") redirect("/");
  await prefetch(serverOrpc.admin.consultations.queryOptions({ input: { page: 1 } }));
  return (
    <HydrateClient>
      <ConsultationDashboard account={account} allConsultations />
    </HydrateClient>
  );
}
