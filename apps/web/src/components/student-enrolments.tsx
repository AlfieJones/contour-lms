"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  keepPreviousData,
  noop,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { PageLayout } from "#components/page-layout.tsx";
import { DataTable } from "#components/data-table.tsx";
import { Badge } from "@lms/ui/badge";
import { Button } from "@lms/ui/button";
import { Field, FieldLabel } from "@lms/ui/field";
import { Form } from "@lms/ui/form";
import { Input } from "@lms/ui/input";
import { orpc } from "#lib/orpc.ts";
import { formText } from "#lib/form.ts";

export function StudentEnrolments() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const enrolMutation = useMutation(orpc.enrolment.enrol.mutationOptions());
  const resendMutation = useMutation(orpc.enrolment.resend.mutationOptions());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const query = useQuery(
    orpc.enrolment.students.queryOptions({ input: { page }, placeholderData: keepPreviousData }),
  );

  const hasMore = query.data?.hasMore;
  const { isPlaceholderData, dataUpdatedAt } = query;
  useEffect(() => {
    if (!hasMore || isPlaceholderData || page >= 10000) return;
    void queryClient
      .query(orpc.enrolment.students.queryOptions({ input: { page: page + 1 } }))
      .catch(noop);
  }, [page, hasMore, isPlaceholderData, dataUpdatedAt, queryClient]);

  async function send(action: () => Promise<{ emailSent: boolean }>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (result.emailSent) setMessage("Enrolment email sent.");
      else setError("Student enrolled. Email failed to send; try Resend email.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save enrolment.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function enrol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = formText(new FormData(form), "email").trim().toLowerCase();
    if (await send(() => enrolMutation.mutateAsync({ email }))) form.reset();
  }

  return (
    <PageLayout title="Students">
      <section className="flex flex-col gap-4" aria-labelledby="enrol-title">
        <div>
          <h2 id="enrol-title" className="text-lg font-medium">
            Enrol a student
          </h2>
        </div>
        <Form onSubmit={enrol} className="flex max-w-md flex-col gap-4">
          <Field name="email">
            <FieldLabel>Student email</FieldLabel>
            <Input
              name="email"
              type="email"
              placeholder="student@example.com"
              required
              maxLength={255}
            />
          </Field>
          <Button type="submit" loading={pending} className="self-start">
            Enrol student
          </Button>
        </Form>
      </section>
      {error && (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <section aria-label="Enrolled students" className="flex flex-col gap-4">
        {query.isPending && (
          <p role="status" className="text-sm">
            Loading students…
          </p>
        )}
        {query.isError && (
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry loading students
          </Button>
        )}
        {query.data && (
          <DataTable
            label="Students"
            rows={query.data.items}
            emptyMessage="No students enrolled yet."
            columns={[
              {
                id: "email",
                header: "Student",
                cell: (item) => <span className="font-medium">{item.studentEmail}</span>,
              },
              {
                id: "status",
                header: "Status",
                cell: (item) => (
                  <Badge variant="outline">
                    <span
                      aria-hidden="true"
                      className={
                        item.studentId
                          ? "size-1.5 rounded-full bg-success-foreground"
                          : "size-1.5 rounded-full bg-muted-foreground"
                      }
                    />
                    {item.studentId ? "Enrolled" : "Awaiting verification"}
                  </Badge>
                ),
              },
              {
                id: "actions",
                header: "Actions",
                className: "text-right",
                cell: (item) => (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending || query.isFetching}
                    aria-label={`Resend enrolment email to ${item.studentEmail}`}
                    onClick={() => void send(() => resendMutation.mutateAsync({ id: item.id }))}
                  >
                    Resend email
                  </Button>
                ),
              },
            ]}
            pagination={{
              page,
              pageSize: 20,
              hasMore: query.data.hasMore,
              disabled: pending || query.isFetching || query.isPlaceholderData,
              onPageChange: setPage,
            }}
          />
        )}
      </section>
    </PageLayout>
  );
}
