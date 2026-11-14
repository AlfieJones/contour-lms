"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "#components/page-layout.tsx";
import { DataTable } from "#components/data-table.tsx";
import { Button } from "@lms/ui/button";
import { orpc } from "#lib/orpc.ts";

export function Teachers() {
  const query = useQuery(orpc.enrolment.teachers.queryOptions());
  return (
    <PageLayout
      title="Teachers"
      actions={
        query.data?.length ? (
          <Button variant="outline" render={<Link href="/" />}>
            Book a consultation
          </Button>
        ) : undefined
      }
    >
      {query.isPending && (
        <p role="status" className="text-sm">
          Loading teachers…
        </p>
      )}
      {query.isError && (
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry loading teachers
        </Button>
      )}
      {query.data && (
        <DataTable
          label="Teachers"
          rows={query.data}
          emptyMessage="Ask your teacher to enrol you using your account email."
          columns={[
            {
              id: "email",
              header: "Teacher",
              cell: (teacher) => <span className="font-medium">{teacher.email}</span>,
            },
          ]}
        />
      )}
    </PageLayout>
  );
}
