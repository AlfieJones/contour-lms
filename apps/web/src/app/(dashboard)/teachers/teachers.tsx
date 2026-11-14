"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageLayout } from "#components/page-layout.tsx";
import { DataTable } from "#components/data-table.tsx";
import { Button } from "@lms/ui/button";
import { Badge } from "@lms/ui/badge";
import { orpc } from "#lib/orpc.ts";

export function Teachers() {
  const [page, setPage] = useState(1);
  const query = useQuery(orpc.enrolment.teachers.queryOptions());
  const pageSize = 20;
  const currentPage = Math.min(page, Math.max(1, Math.ceil((query.data?.length ?? 0) / pageSize)));
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
      <section aria-label="Enrolled teachers" className="flex flex-col gap-4">
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
            rows={query.data.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
            emptyMessage="Ask your teacher to enrol you using your account email."
            columns={[
              {
                id: "name",
                header: "Name",
                cell: (teacher) => <span className="font-medium">{teacher.name ?? "—"}</span>,
              },
              {
                id: "email",
                header: "Email",
                cell: (teacher) => teacher.email,
              },
              {
                id: "status",
                header: "Status",
                cell: () => (
                  <Badge variant="outline">
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-success-foreground"
                    />
                    Enrolled
                  </Badge>
                ),
              },
            ]}
            pagination={{
              page: currentPage,
              pageSize,
              hasMore: currentPage * pageSize < query.data.length,
              disabled: query.isFetching,
              onPageChange: setPage,
            }}
          />
        )}
      </section>
    </PageLayout>
  );
}
