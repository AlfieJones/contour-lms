import { redirect } from "next/navigation";
import { requireAccount } from "#lib/account.server.ts";
import { Teachers } from "#components/teachers.tsx";
import { serverOrpc } from "#lib/orpc.server.ts";
import { HydrateClient, prefetch } from "#lib/query-server.tsx";

export default async function TeachersPage() {
  const account = await requireAccount();
  if (account.role !== "student") redirect("/");
  await prefetch(serverOrpc.enrolment.teachers.queryOptions());
  return (
    <HydrateClient>
      <Teachers />
    </HydrateClient>
  );
}
