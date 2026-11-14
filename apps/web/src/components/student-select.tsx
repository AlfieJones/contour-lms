"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@lms/ui/button";
import { Field, FieldDescription, FieldLabel } from "@lms/ui/field";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@lms/ui/select";
import { orpc } from "#lib/orpc.ts";

export function StudentSelect({ defaultValue }: { defaultValue?: string }) {
  const query = useInfiniteQuery(
    orpc.enrolment.students.infiniteOptions({
      input: (page: number) => ({ page }),
      initialPageParam: 1,
      getNextPageParam: (lastPage, _pages, page) =>
        lastPage.hasMore && page < 10000 ? page + 1 : undefined,
    }),
  );
  const items =
    query.data?.pages
      .flatMap((page) => page.items)
      .map((student) => ({
        value: student.id,
        label: student.studentId
          ? student.studentEmail
          : `${student.studentEmail} (awaiting verification)`,
        disabled: !student.studentId,
      })) ?? [];

  return (
    <Field name="enrolmentId">
      <FieldLabel>Student</FieldLabel>
      <Select
        name="enrolmentId"
        items={items}
        defaultValue={defaultValue ?? null}
        required
        disabled={query.isPending || (!query.data && query.isError)}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={query.isPending ? "Loading students…" : "Choose an enrolled student"}
          />
        </SelectTrigger>
        <SelectPopup>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
      {query.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-destructive-foreground">
            Could not load students.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      {query.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more students
        </Button>
      ) : null}
      {!query.isPending && !query.isError && items.length === 0 ? (
        <FieldDescription>
          No students enrolled yet.{" "}
          <Link href="/students" className="underline underline-offset-4">
            Enrol a student
          </Link>{" "}
          to book for them.
        </FieldDescription>
      ) : (
        <FieldDescription>
          Only students who have verified their accounts can be booked.
        </FieldDescription>
      )}
    </Field>
  );
}
