import { redirect } from "next/navigation";
import { requireAccount } from "#lib/account.server.ts";
import { StudentEnrolments } from "#components/student-enrolments.tsx";
import { serverOrpc } from "#lib/orpc.server.ts";
import { HydrateClient, prefetch } from "#lib/query-server.tsx";

export default async function StudentsPage() {
  const account = await requireAccount();
  if (account.role === "student") redirect("/");
  await prefetch(serverOrpc.enrolment.students.queryOptions({ input: { page: 1 } }));
  return (
    <HydrateClient>
      <StudentEnrolments />
    </HydrateClient>
  );
}
