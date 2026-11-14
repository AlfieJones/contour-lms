"use client";

import { useEffect, useState } from "react";
import {
  keepPreviousData,
  noop,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { DataTable } from "#components/data-table.tsx";
import { Button } from "@lms/ui/button";
import { Badge } from "@lms/ui/badge";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@lms/ui/select";
import { Spinner } from "@lms/ui/spinner";
import { toastManager } from "@lms/ui/toast";
import { type client, orpc } from "#lib/orpc.ts";

type UserPage = Awaited<ReturnType<typeof client.admin.users.list>>;

const roles = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
];

export function UserManagement() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const changeRole = useMutation(
    orpc.admin.users.setRole.mutationOptions({
      onMutate: async ({ userId, role }) => {
        const queryKey = orpc.admin.users.list.key();
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueriesData<UserPage>({ queryKey });
        queryClient.setQueriesData<UserPage>({ queryKey }, (page) =>
          page
            ? {
                ...page,
                items: page.items.map((user) => (user.id === userId ? { ...user, role } : user)),
              }
            : page,
        );
        return previous;
      },
      onError: (_error, _input, previous) => {
        for (const [queryKey, page] of previous ?? []) queryClient.setQueryData(queryKey, page);
      },
      onSettled: async () => {
        await Promise.all(
          [orpc.admin.users.list.key(), orpc.enrolment.key()].map(async (queryKey) => {
            await queryClient.cancelQueries({ queryKey });
            await queryClient.invalidateQueries({ queryKey });
          }),
        );
      },
    }),
  );
  const changingId = changeRole.isPending ? changeRole.variables.userId : null;
  const query = useQuery(
    orpc.admin.users.list.queryOptions({ input: { page }, placeholderData: keepPreviousData }),
  );

  const hasMore = query.data?.hasMore;
  const { isPlaceholderData, dataUpdatedAt } = query;
  useEffect(() => {
    if (!hasMore || isPlaceholderData || page >= 10000) return;
    void queryClient
      .query(orpc.admin.users.list.queryOptions({ input: { page: page + 1 } }))
      .catch(noop);
  }, [page, hasMore, isPlaceholderData, dataUpdatedAt, queryClient]);

  function setRole(userId: string, role: "student" | "teacher", userLabel: string) {
    void toastManager
      .promise(changeRole.mutateAsync({ userId, role }), {
        loading: { title: "Updating role…" },
        success: { title: "Role updated", description: `${userLabel} is now a ${role}.` },
        error: { title: "Could not update role", description: "Please try again." },
      })
      .catch(noop);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {query.isPending && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Spinner /> Loading users…
        </p>
      )}
      {query.isError && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert">Could not load users.</p>
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {query.data && (
        <DataTable
          label="Users"
          rows={query.data.items}
          emptyMessage="No users found."
          columns={[
            {
              id: "name",
              header: "Name",
              cell: (user) => <span className="font-medium">{user.name ?? "—"}</span>,
            },
            {
              id: "email",
              header: "Email",
              cell: (user) => user.email ?? user.id,
            },
            {
              id: "role",
              header: "Role",
              width: 180,
              cell: (user) =>
                user.role === "admin" ? (
                  <Badge variant="outline">Admin</Badge>
                ) : (
                  <Select
                    items={roles}
                    value={user.role}
                    disabled={changingId !== null || query.isFetching}
                    onValueChange={(value) => {
                      if ((value === "student" || value === "teacher") && value !== user.role)
                        setRole(user.id, value, user.email ?? user.id);
                    }}
                  >
                    <SelectTrigger
                      aria-label={`Role for ${user.email ?? user.id}`}
                      size="sm"
                      className="w-32"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectGroup>
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectPopup>
                  </Select>
                ),
            },
          ]}
          pagination={{
            page,
            pageSize: 20,
            hasMore: query.data.hasMore,
            disabled: changingId !== null || query.isFetching || query.isPlaceholderData,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
