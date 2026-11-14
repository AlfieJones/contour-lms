import { redirect } from "next/navigation";
import { PageLayout } from "#components/page-layout.tsx";
import { TeacherAvailability } from "./teacher-availability";
import { requireAccount } from "#lib/account.server.ts";
import { serverOrpc } from "#lib/orpc.server.ts";
import { HydrateClient, prefetch } from "#lib/query-server.tsx";

export default async function AvailabilityPage() {
  const account = await requireAccount();
  if (account.role === "student") redirect("/");
  await prefetch(serverOrpc.consultation.availability.get.queryOptions());

  return (
    <HydrateClient>
      <PageLayout title="Availability">
        <TeacherAvailability />
      </PageLayout>
    </HydrateClient>
  );
}
