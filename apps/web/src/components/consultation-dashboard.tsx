"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  type QueryKey,
  keepPreviousData,
  noop,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarDaysIcon, EllipsisIcon, ListIcon, PlusIcon } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@lms/ui/avatar";
import { Button } from "@lms/ui/button";
import { Dialog, DialogPopup, DialogTrigger } from "@lms/ui/dialog";
import { Menu, MenuGroup, MenuItem, MenuPopup, MenuTrigger } from "@lms/ui/menu";
import { Skeleton } from "@lms/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@lms/ui/tabs";
import { SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetTitle } from "@lms/ui/sheet";
import { ConsultationCalendar } from "#components/consultation-calendar.tsx";
import { toastManager } from "@lms/ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@lms/ui/tooltip";
import { PageLayout } from "#components/page-layout.tsx";
import { DataTable } from "#components/data-table.tsx";
import { type client, orpc } from "#lib/orpc.ts";
import { useLocalTimezone } from "#lib/use-local-timezone.ts";
import type { Account } from "@lms/api";
import { formatBookingDate, formatBookingTime } from "#lib/consultation-scheduling.ts";
import {
  ConsultationScheduler,
  type BookingDetails,
  type BookingFlow,
  type Consultation,
} from "#components/consultation-scheduler.tsx";

type ConsultationPage = Awaited<ReturnType<typeof client.consultation.list>>;

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
  const [view, setView] = useState(admin ? "table" : "calendar");
  const queryClient = useQueryClient();
  const create = useMutation(
    orpc.consultation.create.mutationOptions({ onSuccess: () => refreshConsultations(true) }),
  );
  const createForStudent = useMutation(
    orpc.consultation.createForStudent.mutationOptions({
      onSuccess: () => refreshConsultations(true),
    }),
  );
  const reschedule = useMutation(
    orpc.consultation.reschedule.mutationOptions({ onSuccess: () => refreshConsultations(true) }),
  );
  const cancel = useMutation(
    orpc.consultation.cancel.mutationOptions({
      onMutate: ({ id }) => updateStatus(id, "cancelled"),
      onError: (_error, _input, previous) => restoreConsultations(previous),
      onSettled: () => refreshConsultations(true),
    }),
  );
  const resendCalendarEmail = useMutation(orpc.consultation.resendCalendarEmail.mutationOptions());
  const setComplete = useMutation(
    orpc.consultation.setComplete.mutationOptions({
      onMutate: ({ id, complete }) => updateStatus(id, complete ? "completed" : "scheduled"),
      onError: (_error, _input, previous) => restoreConsultations(previous),
      onSettled: () => refreshConsultations(false),
    }),
  );
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [flow, setFlow] = useState<BookingFlow>({ mode: "book" });
  const [flowVersion, setFlowVersion] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const bookingDialogTitle = useRef<HTMLHeadingElement>(null);
  const bookingButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const timeZone = useLocalTimezone();
  const query = useQuery(
    admin
      ? orpc.admin.consultations.queryOptions({
          input: { page },
          enabled: view === "table",
          placeholderData: keepPreviousData,
        })
      : orpc.consultation.list.queryOptions({
          input: { page },
          enabled: view === "table",
          placeholderData: keepPreviousData,
        }),
  );

  async function refreshConsultations(includeSlots: boolean) {
    const keys: QueryKey[] = [orpc.consultation.list.key(), orpc.admin.consultations.key()];
    if (includeSlots) keys.push(orpc.consultation.availability.slots.key());
    await Promise.all(
      keys.map(async (queryKey) => {
        // Cancel inactive page prefetches too, so stale results cannot land after invalidation.
        await queryClient.cancelQueries({ queryKey });
        await queryClient.invalidateQueries({ queryKey });
      }),
    );
  }

  async function updateStatus(id: string, status: Consultation["status"]) {
    const keys = [orpc.consultation.list.key(), orpc.admin.consultations.key()];
    await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
    const previous = keys.flatMap((queryKey) =>
      queryClient.getQueriesData<ConsultationPage>({ queryKey }),
    );
    for (const queryKey of keys) {
      queryClient.setQueriesData<ConsultationPage>({ queryKey }, (page) =>
        page
          ? {
              ...page,
              items: page.items.map((item) => (item.id === id ? { ...item, status } : item)),
            }
          : page,
      );
    }
    return previous;
  }

  function restoreConsultations(previous: Awaited<ReturnType<typeof updateStatus>> | undefined) {
    for (const [queryKey, page] of previous ?? []) queryClient.setQueryData(queryKey, page);
  }

  const hasMore = query.data?.hasMore;
  const { isPlaceholderData, dataUpdatedAt } = query;
  useEffect(() => {
    if (view !== "table" || !hasMore || isPlaceholderData || page >= 10000) return;
    const options = admin
      ? orpc.admin.consultations.queryOptions({ input: { page: page + 1 } })
      : orpc.consultation.list.queryOptions({ input: { page: page + 1 } });
    void queryClient.query(options).catch(noop);
  }, [admin, page, view, hasMore, isPlaceholderData, dataUpdatedAt, queryClient]);

  async function save<T>(
    action: () => Promise<T>,
    success: string,
    rethrow = false,
  ): Promise<T | null> {
    if (saving.current) return null;
    saving.current = true;
    setPending(true);
    setError("");
    try {
      const result = await action();
      const emailFailed =
        result && typeof result === "object" && "emailSent" in result && result.emailSent === false;
      if (!emailFailed && success) toastManager.add({ type: "success", title: success });
      if (emailFailed) {
        setError(
          "Your change is saved, but some calendar emails couldn’t be sent. Choose Resend calendar email from the consultation’s actions to try again.",
        );
      }
      return result;
    } catch (error) {
      if (rethrow) throw error;
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
    setBookingOpen(true);
  }

  function book(details: BookingDetails) {
    return save(
      () =>
        flow.mode === "reschedule"
          ? reschedule.mutateAsync({
              id: flow.consultation.id,
              teacherId: details.teacherId,
              scheduledAt: details.scheduledAt,
              durationMinutes: details.durationMinutes,
            })
          : bookingForStudents
            ? createForStudent.mutateAsync({
                enrolmentId: details.enrolmentId!,
                reason: details.reason,
                scheduledAt: details.scheduledAt,
                durationMinutes: details.durationMinutes,
              })
            : create.mutateAsync(details),
      "",
      true,
    );
  }

  function bookingActions(item: Consultation, close?: () => void, inSheet = false) {
    return (
      <BookingActions
        item={item}
        student={student}
        canBook={canBook}
        timeZone={timeZone}
        pending={pending}
        error={error}
        inSheet={inSheet}
        onStart={(next) => {
          close?.();
          startFlow(next);
        }}
        onCancel={() => save(() => cancel.mutateAsync({ id: item.id }), "Consultation cancelled.")}
        onComplete={() =>
          void save(
            () =>
              setComplete.mutateAsync({
                id: item.id,
                complete: item.status !== "completed",
              }),
            item.status === "completed"
              ? "Consultation marked incomplete."
              : "Consultation marked complete.",
          )
        }
        onResend={() =>
          void save(() => resendCalendarEmail.mutateAsync({ id: item.id }), "Calendar emails sent.")
        }
      />
    );
  }

  const tableContent = (
    <div className="flex flex-col gap-4">
      {query.isPending && (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Loading consultations…</span>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}
      {query.isError && (
        <Alert variant="error">
          <AlertDescription>
            Couldn’t load your consultations. Try again or log in again if your session has expired.
            <Button variant="outline" className="self-start" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {query.data && (
        <DataTable<Consultation>
          label={admin ? "Consultations" : "Your consultations"}
          rows={query.data.items}
          emptyMessage="No consultations yet."
          columns={[
            ...(!student
              ? [
                  {
                    id: "student",
                    header: "Student",
                    className: "min-w-40 max-w-64 whitespace-normal",
                    cell: (item: Consultation) => <StudentIdentity item={item} />,
                  },
                ]
              : []),
            {
              id: "reason",
              header: "Discussion",
              className: "min-w-48 max-w-sm whitespace-pre-wrap break-words leading-relaxed",
              cell: (item) => <span className="text-muted-foreground">{item.reason}</span>,
            },
            ...(admin || student
              ? [
                  {
                    id: "teacher",
                    header: "Teacher",
                    className: "max-w-56 whitespace-normal break-all leading-relaxed",
                    cell: (item: Consultation) => item.teacherEmail ?? "No teacher assigned",
                  },
                ]
              : []),
            {
              id: "date",
              header: "Date & time",
              cell: (item) => (
                <div className="flex flex-col gap-1.5 tabular-nums">
                  <time dateTime={item.scheduledAt.toISOString()}>
                    {timeZone ? formatBookingDate(item.scheduledAt, timeZone) : "Loading date…"}
                  </time>
                  <span className="text-xs text-muted-foreground">
                    {timeZone ? formatBookingTime(item.scheduledAt, timeZone) : "—"} ·{" "}
                    {item.durationMinutes} min
                  </span>
                </div>
              ),
            },
            {
              id: "status",
              header: "Status",
              className: "w-px",
              cell: (item) => <ConsultationStatus item={item} />,
            },
            ...(!admin
              ? [
                  {
                    id: "actions",
                    header: "Actions",
                    className: "w-px text-right",
                    cell: (item: Consultation) => bookingActions(item),
                  },
                ]
              : []),
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
    </div>
  );

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
      {error && !bookingOpen && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!admin && (
        <TabsPanel value="calendar">
          <ConsultationCalendar
            student={student}
            renderDetails={(item, close) => (
              <ConsultationDetails
                item={item}
                student={student}
                timeZone={timeZone}
                error={error}
                actions={bookingActions(item, close, true)}
              />
            )}
          />
        </TabsPanel>
      )}
      {admin ? tableContent : <TabsPanel value="table">{tableContent}</TabsPanel>}
    </div>
  );

  const dashboard = (
    <PageLayout
      title={admin ? "All consultations" : "Consultations"}
      actions={
        <>
          {!admin && (
            <TabsList aria-label="Booking view">
              <TabsTab value="table">
                <ListIcon aria-hidden="true" /> Table
              </TabsTab>
              <TabsTab value="calendar">
                <CalendarDaysIcon aria-hidden="true" /> Calendar
              </TabsTab>
            </TabsList>
          )}
          {canBook && (
            <DialogTrigger
              render={
                <Button
                  ref={bookingButton}
                  type="button"
                  disabled={pending}
                  onClick={() => startFlow({ mode: "book" })}
                />
              }
            >
              <PlusIcon aria-hidden="true" /> New consultation
            </DialogTrigger>
          )}
        </>
      }
    >
      {content}
    </PageLayout>
  );

  const dashboardPage = admin ? (
    dashboard
  ) : (
    <Tabs value={view} onValueChange={(value) => setView(String(value))}>
      {dashboard}
    </Tabs>
  );

  if (admin) return dashboardPage;

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
        className="max-h-[min(40rem,calc(100dvh-3rem))] max-w-2xl overflow-hidden sm:max-h-[min(40rem,calc(100dvh-2rem))]"
        closeProps={{ disabled: pending }}
        initialFocus={bookingDialogTitle}
        finalFocus={bookingButton}
      >
        {error && (
          <Alert variant="error" className="mx-6 mt-4 w-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <ConsultationScheduler
          teachers={bookingTeachers}
          bookingForStudents={bookingForStudents}
          headingRef={bookingDialogTitle}
          key={flowVersion}
          flow={flow}
          onSave={book}
        />
      </DialogPopup>
    </Dialog>
  );
}

function ConsultationDetails({
  item,
  student,
  timeZone,
  error,
  actions,
}: {
  item: Consultation;
  student: boolean;
  timeZone?: string;
  error: string;
  actions: ReactNode;
}) {
  const studentName = `${item.firstName} ${item.lastName}`.trim();
  const teacherName = item.teacherName || item.teacherEmail || "Your teacher";
  const name = student ? teacherName : studentName;

  return (
    <>
      <SheetHeader className="gap-5 pr-14">
        <div>
          <ConsultationStatus item={item} />
        </div>
        <SheetTitle className="border-l-2 pl-3 text-2xl leading-snug tracking-tight break-words">
          {item.durationMinutes} min consultation with {name}
        </SheetTitle>
        <SheetDescription className="sr-only">Consultation booking details</SheetDescription>
      </SheetHeader>
      <SheetPanel className="flex flex-col gap-7">
        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <dl className="flex flex-col gap-7 text-sm">
          <div className="flex flex-col gap-2">
            <dt className="text-muted-foreground">When</dt>
            <dd className="flex flex-col gap-1 text-base">
              <time dateTime={item.scheduledAt.toISOString()}>
                {timeZone
                  ? new Intl.DateTimeFormat("en-AU", { dateStyle: "full", timeZone }).format(
                      item.scheduledAt,
                    )
                  : "Loading date…"}
              </time>
              <span className="tabular-nums">
                {timeZone && formatBookingTime(item.scheduledAt, timeZone)} –{" "}
                {timeZone &&
                  formatBookingTime(
                    new Date(item.scheduledAt.getTime() + item.durationMinutes * 60_000),
                    timeZone,
                  )}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-muted-foreground">Who</dt>
            <dd className="flex flex-col gap-4">
              {student && (
                <PersonIdentity
                  name={item.teacherName}
                  email={item.teacherEmail}
                  avatarUrl={item.teacherAvatarUrl}
                  fallback="No teacher assigned"
                />
              )}
              {!student && (
                <PersonIdentity
                  name={studentName}
                  email={item.studentEmail}
                  avatarUrl={item.studentAvatarUrl}
                  fallback="Student"
                />
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-2">
            <dt className="text-muted-foreground">Additional notes</dt>
            <dd className="text-base whitespace-pre-wrap break-words leading-relaxed">
              {item.reason}
            </dd>
          </div>
        </dl>
      </SheetPanel>
      {actions && <SheetFooter>{actions}</SheetFooter>}
    </>
  );
}

function PersonIdentity({
  name,
  email,
  avatarUrl,
  fallback,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  fallback: string;
}) {
  const displayName = name || email || fallback;
  const initials = (name || email?.split("@")[0] || fallback)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-10 shrink-0" aria-hidden="true">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5 text-base">
        <span className="font-medium break-words">{displayName}</span>
        {name && email && <span className="break-all text-muted-foreground">{email}</span>}
      </div>
    </div>
  );
}

function ConsultationStatus({ item }: { item: Consultation }) {
  return (
    <Badge
      variant={
        item.status === "scheduled" ? "info" : item.status === "completed" ? "success" : "secondary"
      }
    >
      {item.status === "scheduled"
        ? "Scheduled"
        : item.status === "completed"
          ? "Completed"
          : "Cancelled"}
    </Badge>
  );
}

function StudentIdentity({ item }: { item: Consultation }) {
  const studentName = `${item.firstName} ${item.lastName}`.trim();
  const studentInitials = [item.firstName, item.lastName]
    .map((name) => name.trim()[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="inline-flex max-w-full items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        }
      >
        <Avatar className="size-6" aria-hidden="true">
          {item.studentAvatarUrl && <AvatarImage src={item.studentAvatarUrl} alt="" />}
          <AvatarFallback>{studentInitials}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 font-medium break-words">{studentName}</span>
      </TooltipTrigger>
      <TooltipPopup className="max-w-[calc(100vw-2rem)] break-all" align="start">
        {item.studentEmail ?? "Email unavailable"}
      </TooltipPopup>
    </Tooltip>
  );
}

function BookingActions({
  item,
  student,
  canBook,
  timeZone,
  pending,
  error,
  inSheet = false,
  onStart,
  onCancel,
  onComplete,
  onResend,
}: {
  item: Consultation;
  student: boolean;
  canBook: boolean;
  timeZone?: string;
  pending: boolean;
  error: string;
  inSheet?: boolean;
  onStart: (flow: BookingFlow) => void;
  onCancel: () => Promise<Consultation | null>;
  onComplete: () => void;
  onResend: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const actionsButton = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const date = item.scheduledAt;
  return (
    <div
      className={
        inSheet
          ? "flex flex-wrap items-center justify-end gap-2"
          : "flex items-center justify-end gap-1"
      }
    >
      {student &&
        (item.status === "scheduled" ? (
          <>
            <AlertDialog
              open={cancelOpen}
              onOpenChange={(open) => {
                if (!pending) setCancelOpen(open);
              }}
            >
              {inSheet && (
                <AlertDialogTrigger render={<Button variant="ghost" disabled={pending} />}>
                  Cancel booking
                </AlertDialogTrigger>
              )}
              <AlertDialogPopup finalFocus={inSheet ? undefined : actionsButton}>
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
        ) : inSheet ? (
          <Button
            variant="outline"
            size="default"
            disabled={pending || !canBook}
            onClick={() => onStart({ mode: "rebook", consultation: item })}
          >
            <PlusIcon aria-hidden="true" /> Book again
          </Button>
        ) : null)}
      <Menu
        onOpenChange={(open) => {
          if (open) openingDialog.current = false;
        }}
      >
        <MenuTrigger
          render={
            <Button
              type="button"
              ref={actionsButton}
              variant={inSheet ? "outline" : "ghost"}
              size={inSheet ? "icon" : "icon-xs"}
              disabled={pending}
              aria-label={
                student
                  ? "Consultation actions"
                  : `Actions for ${item.firstName} ${item.lastName} consultation`
              }
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="end" finalFocus={() => !openingDialog.current}>
          <MenuGroup>
            {!inSheet && student && item.status !== "scheduled" && (
              <MenuItem
                closeOnClick
                disabled={pending || !canBook}
                onClick={() => {
                  openingDialog.current = true;
                  onStart({ mode: "rebook", consultation: item });
                }}
              >
                Book again
              </MenuItem>
            )}
            <MenuItem disabled={pending} onClick={onResend}>
              Resend calendar email
            </MenuItem>
            {item.status === "scheduled" && (
              <MenuItem
                closeOnClick
                disabled={pending || (student && !canBook)}
                onClick={() => {
                  openingDialog.current = true;
                  onStart({ mode: "reschedule", consultation: item });
                }}
              >
                Reschedule
              </MenuItem>
            )}
            {item.status !== "cancelled" && (
              <MenuItem disabled={pending} onClick={onComplete}>
                {item.status === "completed" ? "Mark incomplete" : "Mark complete"}
              </MenuItem>
            )}
            {!inSheet && student && item.status === "scheduled" && (
              <MenuItem
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  openingDialog.current = true;
                  setCancelOpen(true);
                }}
              >
                Cancel booking
              </MenuItem>
            )}
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </div>
  );
}
