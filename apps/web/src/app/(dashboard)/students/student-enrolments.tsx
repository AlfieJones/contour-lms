"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { EllipsisIcon } from "lucide-react";
import {
  keepPreviousData,
  noop,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { PageLayout } from "#components/page-layout.tsx";
import { DataTable } from "#components/data-table.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@lms/ui/avatar";
import { Badge } from "@lms/ui/badge";
import { Button } from "@lms/ui/button";
import { Checkbox } from "@lms/ui/checkbox";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@lms/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@lms/ui/dialog";
import { Field, FieldLabel } from "@lms/ui/field";
import { Form } from "@lms/ui/form";
import { Input } from "@lms/ui/input";
import { Menu, MenuGroup, MenuItem, MenuPopup, MenuTrigger } from "@lms/ui/menu";
import { toastManager } from "@lms/ui/toast";
import { orpc } from "#lib/orpc.ts";
import { formText } from "#lib/form.ts";

export function StudentEnrolments() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const enrolMutation = useMutation(
    orpc.enrolment.enrol.mutationOptions({
      onSuccess: async () => {
        const queryKey = orpc.enrolment.key();
        await queryClient.cancelQueries({ queryKey });
        await queryClient.invalidateQueries({ queryKey });
      },
    }),
  );
  const unenrolMutation = useMutation(
    orpc.enrolment.unenrol.mutationOptions({
      onSuccess: async (_result, { cancelUpcoming }) => {
        const keys = [orpc.enrolment.key()];
        if (cancelUpcoming) {
          keys.push(
            orpc.consultation.list.key(),
            orpc.admin.consultations.key(),
            orpc.consultation.availability.slots.key(),
          );
        }
        await Promise.all(
          keys.map(async (queryKey) => {
            await queryClient.cancelQueries({ queryKey });
            await queryClient.invalidateQueries({ queryKey });
          }),
        );
      },
    }),
  );
  const [pending, setPending] = useState(false);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [error, setError] = useState("");
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
    try {
      const result = await action();
      if (result.emailSent) toastManager.add({ title: "Enrolment email sent.", type: "success" });
      else setError("Student enrolled, but the enrolment email couldn’t be sent.");
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
    const formData = new FormData(form);
    const email = formText(formData, "email").trim().toLowerCase();
    if (await send(() => enrolMutation.mutateAsync({ email }))) {
      form.reset();
      setEnrolOpen(false);
    }
  }

  async function unenrol(id: string, cancelUpcoming: boolean) {
    setPending(true);
    setError("");
    try {
      const result = await unenrolMutation.mutateAsync({ id, cancelUpcoming });
      if (!result.emailSent) {
        setError(
          "Student unenrolled and consultations cancelled, but some calendar emails couldn’t be sent. Use Resend calendar email on the cancelled consultations to retry.",
        );
      }
      if (query.data?.items.length === 1 && page > 1) setPage(page - 1);
      toastManager.add({
        title: cancelUpcoming
          ? "Student unenrolled. Upcoming consultations cancelled."
          : "Student unenrolled.",
        type: "success",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <PageLayout
      title="Students"
      actions={
        <Dialog
          open={enrolOpen}
          disablePointerDismissal={pending}
          onOpenChange={(open, eventDetails) => {
            if (pending) {
              eventDetails.cancel();
              return;
            }
            setEnrolOpen(open);
            setError("");
          }}
        >
          <DialogTrigger render={<Button type="button" disabled={pending} />}>
            Enrol student
          </DialogTrigger>
          <DialogPopup closeProps={{ disabled: pending }}>
            <DialogHeader>
              <DialogTitle>Enrol a student</DialogTitle>
              <DialogDescription>Send an enrolment invitation by email.</DialogDescription>
            </DialogHeader>
            <Form onSubmit={enrol} className="contents">
              <DialogPanel className="flex flex-col gap-4">
                <Field name="email" disabled={pending}>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    name="email"
                    type="email"
                    placeholder="student@example.com"
                    required
                    maxLength={255}
                  />
                </Field>
                {error && (
                  <p role="alert" className="text-sm text-destructive-foreground">
                    {error}
                  </p>
                )}
              </DialogPanel>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
                  Cancel
                </DialogClose>
                <Button type="submit" loading={pending}>
                  Enrol student
                </Button>
              </DialogFooter>
            </Form>
          </DialogPopup>
        </Dialog>
      }
    >
      {error && !enrolOpen && (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
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
                id: "name",
                header: "Name",
                cell: (item) => <span className="font-medium">{item.studentName ?? "—"}</span>,
              },
              {
                id: "email",
                header: "Email",
                cell: (item) => item.studentEmail,
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
                  <StudentActions
                    email={item.studentEmail}
                    name={item.studentName}
                    avatarUrl={item.studentAvatarUrl}
                    disabled={pending || query.isFetching}
                    pending={pending}
                    onUnenrol={(cancelUpcoming) => unenrol(item.id, cancelUpcoming)}
                  />
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

function StudentActions({
  email,
  name,
  avatarUrl,
  disabled,
  pending,
  onUnenrol,
}: {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  disabled: boolean;
  pending: boolean;
  onUnenrol: (cancelUpcoming: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [cancelUpcoming, setCancelUpcoming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initials = (name || email)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function confirmUnenrol() {
    setError("");
    try {
      await onUnenrol(cancelUpcoming);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not unenrol student. Try again.");
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (pending) {
          eventDetails.cancel();
          return;
        }
        setOpen(nextOpen);
        setCancelUpcoming(false);
        setError("");
      }}
    >
      <Menu>
        <MenuTrigger
          render={
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              aria-label={`Actions for ${email}`}
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuGroup>
            <MenuItem variant="destructive" disabled={disabled} onClick={() => setOpen(true)}>
              Unenrol student
            </MenuItem>
          </MenuGroup>
        </MenuPopup>
      </Menu>
      <AlertDialogPopup finalFocus={triggerRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>Unenrol this student?</AlertDialogTitle>
          <div className="my-2 flex items-center gap-3 text-left">
            <Avatar className="size-10" aria-hidden="true">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium break-words">{name || "Student"}</p>
              <p className="text-sm text-muted-foreground break-all">{email}</p>
            </div>
          </div>
          <AlertDialogDescription>
            They won’t be able to book new consultations with you.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field disabled={pending} className="flex-row items-center gap-2 px-6 pb-4">
          <Checkbox
            checked={cancelUpcoming}
            onCheckedChange={(checked) => setCancelUpcoming(checked === true)}
            disabled={pending}
          />
          <FieldLabel>Cancel upcoming consultations</FieldLabel>
        </Field>
        {error && (
          <p role="alert" className="px-6 pb-4 text-sm text-destructive-foreground">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
            Cancel
          </AlertDialogClose>
          <Button
            type="button"
            variant="destructive"
            loading={pending}
            onClick={() => void confirmUnenrol()}
          >
            Unenrol student
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
