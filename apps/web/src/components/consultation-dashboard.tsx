"use client";

import { useEffect, useRef, useState } from "react";
import {
  keepPreviousData,
  noop,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@lms/ui/alert";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@lms/ui/alert-dialog";
import { Badge } from "@lms/ui/badge";
import { Button } from "@lms/ui/button";
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
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@lms/ui/empty";
import { Skeleton } from "@lms/ui/skeleton";
import { PageLayout } from "#components/page-layout.tsx";
import { DataTable } from "#components/data-table.tsx";
import { orpc } from "#lib/orpc.ts";
import { useLocalTimezone } from "#lib/use-local-timezone.ts";
import type { Account } from "@lms/api";
import { formatBookingDate, formatBookingTime } from "#lib/consultation-scheduling.ts";
import {
  ConsultationScheduler,
  type BookingDetails,
  type BookingFlow,
  type Consultation,
} from "#components/consultation-scheduler.tsx";

export function ConsultationDashboard({
  account,
  allConsultations = false,
}: {
  account: Account;
  allConsultations?: boolean;
}) {
  const { role } = account;
  const admin = role === "admin" && allConsultations;
  const student = role === "student";
  const teachers = useQuery(orpc.enrolment.teachers.queryOptions({ enabled: student }));
  const bookingForStudents = !student && !allConsultations;
  const bookingTeachers = bookingForStudents
    ? [{ id: account.id, email: account.email }]
    : (teachers.data ?? []);
  const canBook = bookingForStudents || (student && !!teachers.data?.length);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const create = useMutation(orpc.consultation.create.mutationOptions());
  const createForStudent = useMutation(orpc.consultation.createForStudent.mutationOptions());
  const reschedule = useMutation(orpc.consultation.reschedule.mutationOptions());
  const cancel = useMutation(orpc.consultation.cancel.mutationOptions());
  const setComplete = useMutation(orpc.consultation.setComplete.mutationOptions());
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [flow, setFlow] = useState<BookingFlow>({ mode: "book" });
  const [flowVersion, setFlowVersion] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookingDialogTitle = useRef<HTMLHeadingElement>(null);
  const bookingButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const timeZone = useLocalTimezone();
  const schedulerHeading = useRef<HTMLHeadingElement>(null);
  const query = useQuery(
    admin
      ? orpc.admin.consultations.queryOptions({
          input: { page },
          placeholderData: keepPreviousData,
        })
      : orpc.consultation.list.queryOptions({ input: { page }, placeholderData: keepPreviousData }),
  );

  const hasMore = query.data?.hasMore;
  const { isPlaceholderData, dataUpdatedAt } = query;
  useEffect(() => {
    if (!hasMore || isPlaceholderData || page >= 10000) return;
    const options = admin
      ? orpc.admin.consultations.queryOptions({ input: { page: page + 1 } })
      : orpc.consultation.list.queryOptions({ input: { page: page + 1 } });
    void queryClient.query(options).catch(noop);
  }, [admin, page, hasMore, isPlaceholderData, dataUpdatedAt, queryClient]);

  async function save<T>(action: () => Promise<T>, success: string): Promise<T | null> {
    if (saving.current) return null;
    saving.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      setMessage(success);
      return result;
    } catch {
      setError("We couldn’t save that change. Try again, or refresh if your session has expired.");
      return null;
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  function startFlow(next: BookingFlow) {
    if (saving.current) return;
    setFlow(next);
    setFlowVersion((version) => version + 1);
    setError("");
    setMessage("");
    if (bookingForStudents) return;
    schedulerHeading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    schedulerHeading.current?.focus({ preventScroll: true });
  }

  function book(details: BookingDetails) {
    return save(
      () =>
        flow.mode === "reschedule"
          ? reschedule.mutateAsync({
              id: flow.consultation.id,
              teacherId: details.teacherId,
              scheduledAt: details.scheduledAt,
            })
          : bookingForStudents
            ? createForStudent.mutateAsync({
                enrolmentId: details.enrolmentId!,
                firstName: details.firstName,
                lastName: details.lastName,
                reason: details.reason,
                scheduledAt: details.scheduledAt,
              })
            : create.mutateAsync(details),
      "",
    );
  }

  const content = (
    <div className="flex min-w-0 flex-col gap-6">
      {student && teachers.isPending && (
        <p role="status" className="text-sm">
          Loading your teachers…
        </p>
      )}
      {student && teachers.isError && (
        <Button variant="outline" onClick={() => void teachers.refetch()}>
          Retry loading teachers
        </Button>
      )}
      {student && teachers.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Ask your teacher to enrol you to start booking.
        </p>
      )}
      {canBook && !bookingForStudents && (
        <section aria-labelledby="booking-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="booking-title"
              ref={schedulerHeading}
              tabIndex={-1}
              className="scroll-mt-6 text-sm font-medium outline-none"
            >
              {flow.mode === "reschedule"
                ? "Reschedule"
                : flow.mode === "rebook"
                  ? "Book again"
                  : "Book a consultation"}
            </h2>
          </div>
          <ConsultationScheduler
            teachers={bookingTeachers}
            bookingForStudents={bookingForStudents}
            key={flowVersion}
            flow={flow}
            onSave={book}
            onReset={() => startFlow({ mode: "book" })}
          />
        </section>
      )}

      {error && !bookingOpen && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="success" role="status">
          <CheckIcon aria-hidden="true" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="consultations-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="consultations-title" className="text-lg font-semibold tracking-tight">
              {admin ? "Consultations" : "Your bookings"}
            </h2>
          </div>
        </div>
        {query.isPending && (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Loading consultations…</span>
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        )}
        {query.isError && (
          <Alert variant="error">
            <AlertDescription>
              Couldn’t load your consultations. Try again or log in again if your session has
              expired.
              <Button variant="outline" className="self-start" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {query.data &&
          (admin ? (
            <DataTable
              label="Consultations"
              rows={query.data.items}
              emptyMessage="No consultations yet."
              columns={[
                {
                  id: "date",
                  header: "Date & time",
                  cell: (item) => (
                    <div className="flex flex-col gap-1 tabular-nums">
                      <time dateTime={item.scheduledAt.toISOString()}>
                        {timeZone ? formatBookingDate(item.scheduledAt, timeZone) : "Loading date…"}
                      </time>
                      <span className="text-xs text-muted-foreground">
                        {timeZone ? formatBookingTime(item.scheduledAt, timeZone) : "—"} · 30 min
                      </span>
                    </div>
                  ),
                },
                {
                  id: "student",
                  header: "Student",
                  cell: (item) => (
                    <span className="font-medium">
                      {item.firstName} {item.lastName}
                    </span>
                  ),
                },
                {
                  id: "teacher",
                  header: "Teacher",
                  cell: (item) => item.teacherEmail ?? "No teacher assigned",
                },
                {
                  id: "reason",
                  header: "Reason",
                  className: "min-w-48 max-w-sm whitespace-normal leading-relaxed",
                  cell: (item) => item.reason,
                },
                {
                  id: "status",
                  header: "Status",
                  cell: (item) => (
                    <Badge variant="outline">
                      <span
                        aria-hidden="true"
                        className={
                          item.status === "scheduled"
                            ? "size-1.5 rounded-full bg-info-foreground"
                            : item.status === "completed"
                              ? "size-1.5 rounded-full bg-success-foreground"
                              : "size-1.5 rounded-full bg-muted-foreground"
                        }
                      />
                      <span className="capitalize">{item.status}</span>
                    </Badge>
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
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border bg-card">
                {query.data.items.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CalendarDaysIcon aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>No consultations yet</EmptyTitle>
                    </EmptyHeader>
                    {canBook &&
                      (bookingForStudents ? (
                        <DialogTrigger
                          render={
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => startFlow({ mode: "book" })}
                            />
                          }
                        >
                          Find a time <ArrowRightIcon aria-hidden="true" />
                        </DialogTrigger>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => startFlow({ mode: "book" })}
                        >
                          Find a time <ArrowRightIcon aria-hidden="true" />
                        </Button>
                      ))}
                  </Empty>
                ) : (
                  <ul className="divide-y">
                    {query.data.items.map((item) => (
                      <BookingRow
                        key={item.id}
                        item={item}
                        admin={admin}
                        student={student}
                        canBook={canBook}
                        timeZone={timeZone}
                        pending={pending}
                        error={error}
                        onStart={startFlow}
                        onCancel={() =>
                          save(() => cancel.mutateAsync({ id: item.id }), "Consultation cancelled.")
                        }
                        onComplete={() =>
                          void save(
                            () =>
                              setComplete.mutateAsync({
                                id: item.id,
                                complete: item.status !== "completed",
                              }),
                            "Consultation updated.",
                          )
                        }
                      />
                    ))}
                  </ul>
                )}
              </div>
              {(page > 1 || query.data.hasMore) && (
                <nav
                  aria-label="Consultation pages"
                  className="flex items-center justify-between gap-3"
                >
                  <Button
                    variant="outline"
                    disabled={page === 1 || pending || query.isFetching}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeftIcon aria-hidden="true" /> Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {page}</span>
                  <Button
                    variant="outline"
                    disabled={
                      !query.data.hasMore ||
                      page >= 10000 ||
                      pending ||
                      query.isFetching ||
                      query.isPlaceholderData
                    }
                    onClick={() => setPage(page + 1)}
                  >
                    Next <ChevronRightIcon aria-hidden="true" />
                  </Button>
                </nav>
              )}
            </>
          ))}
      </section>
    </div>
  );

  const dashboardPage = (
    <PageLayout
      title={admin ? "All consultations" : "Consultations"}
      actions={
        canBook ? (
          bookingForStudents ? (
            <DialogTrigger
              render={
                <Button
                  ref={bookingButton}
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => startFlow({ mode: "book" })}
                />
              }
            >
              <PlusIcon aria-hidden="true" /> New consultation
            </DialogTrigger>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => startFlow({ mode: "book" })}
            >
              <PlusIcon aria-hidden="true" /> New consultation
            </Button>
          )
        ) : undefined
      }
    >
      {content}
    </PageLayout>
  );

  if (!bookingForStudents) return dashboardPage;

  return (
    <Dialog
      open={bookingOpen}
      disablePointerDismissal={pending}
      onOpenChange={(open, eventDetails) => {
        if (saving.current) {
          eventDetails.cancel();
          return;
        }
        setBookingOpen(open);
        if (!open) setError("");
      }}
    >
      {dashboardPage}
      <DialogPopup
        className="max-h-[calc(100dvh-3rem)] max-w-6xl sm:max-h-[calc(100dvh-2rem)]"
        closeProps={{ disabled: pending }}
        initialFocus={bookingDialogTitle}
        finalFocus={bookingButton}
      >
        <DialogHeader className="pe-14">
          <DialogTitle ref={bookingDialogTitle} tabIndex={-1}>
            Book a consultation for a student
          </DialogTitle>
          <DialogDescription>
            Choose a time and an enrolled student to book on their behalf.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {error && (
            <Alert variant="error" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <ConsultationScheduler
            teachers={bookingTeachers}
            bookingForStudents
            key={flowVersion}
            flow={flow}
            onSave={book}
            onReset={() => startFlow({ mode: "book" })}
          />
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function BookingRow({
  item,
  admin,
  student,
  canBook,
  timeZone,
  pending,
  error,
  onStart,
  onCancel,
  onComplete,
}: {
  item: Consultation;
  admin: boolean;
  student: boolean;
  canBook: boolean;
  timeZone?: string;
  pending: boolean;
  error: string;
  onStart: (flow: BookingFlow) => void;
  onCancel: () => Promise<Consultation | null>;
  onComplete: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const date = item.scheduledAt;
  return (
    <li className="flex min-w-0 flex-col gap-4 p-5 lg:flex-row lg:items-start lg:gap-5 lg:p-6">
      <div className="flex shrink-0 items-start gap-4 lg:w-48">
        <div
          className="flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border bg-muted/30"
          aria-hidden="true"
        >
          <span className="text-[10px] font-medium uppercase text-muted-foreground">
            {timeZone ? date.toLocaleDateString("en-AU", { timeZone, month: "short" }) : "—"}
          </span>
          <span className="text-lg leading-none font-semibold">
            {timeZone ? date.toLocaleDateString("en-AU", { timeZone, day: "numeric" }) : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-1 pt-0.5 text-sm">
          <time dateTime={date.toISOString()}>
            {timeZone ? formatBookingDate(date, timeZone) : "Loading date…"}
          </time>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3Icon className="size-3" aria-hidden="true" />
            {timeZone ? formatBookingTime(date, timeZone) : "—"} · 30 min
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-sm font-medium break-words">
            {item.firstName} {item.lastName}
          </h3>
          <Badge
            variant={
              item.status === "scheduled"
                ? "info"
                : item.status === "completed"
                  ? "success"
                  : "secondary"
            }
          >
            {item.status === "scheduled"
              ? "Scheduled"
              : item.status === "completed"
                ? "Completed"
                : "Cancelled"}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
          {item.reason}
        </p>
        <p className="text-xs text-muted-foreground break-all">
          {item.teacherEmail ? `Teacher: ${item.teacherEmail}` : "No teacher assigned"}
        </p>
        {!admin && (
          <div className="flex flex-wrap gap-1 pt-1">
            {student &&
              (item.status === "scheduled" ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending || !canBook}
                    onClick={() => onStart({ mode: "reschedule", consultation: item })}
                  >
                    <RotateCcwIcon aria-hidden="true" /> Reschedule
                  </Button>
                  <AlertDialog
                    open={cancelOpen}
                    onOpenChange={(open) => {
                      if (!pending) setCancelOpen(open);
                    }}
                  >
                    <AlertDialogTrigger
                      render={<Button variant="ghost" size="sm" disabled={pending} />}
                    >
                      Cancel booking
                    </AlertDialogTrigger>
                    <AlertDialogPopup>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this consultation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {timeZone
                            ? `${formatBookingDate(date, timeZone)} at ${formatBookingTime(date, timeZone)} (${timeZone}). `
                            : ""}
                          This will cancel your booking. You can book a new time later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      {error && (
                        <Alert variant="error" className="mx-6 w-auto">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant="ghost" disabled={pending} />}>
                          Keep booking
                        </AlertDialogClose>
                        <Button
                          variant="destructive"
                          loading={pending}
                          onClick={async () => {
                            if (await onCancel()) setCancelOpen(false);
                          }}
                        >
                          Cancel consultation
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogPopup>
                  </AlertDialog>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || !canBook}
                  onClick={() => onStart({ mode: "rebook", consultation: item })}
                >
                  <PlusIcon aria-hidden="true" /> Book again
                </Button>
              ))}
            {item.status !== "cancelled" && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={onComplete}>
                {item.status === "completed" ? "Mark incomplete" : "Mark complete"}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
