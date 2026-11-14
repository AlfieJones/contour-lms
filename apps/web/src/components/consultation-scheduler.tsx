"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Controller, useController, useForm, useWatch, type Control } from "react-hook-form";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, Clock3Icon } from "lucide-react";
import { Alert, AlertDescription } from "@lms/ui/alert";
import { Button } from "@lms/ui/button";
import { Calendar } from "@lms/ui/calendar";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@lms/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@lms/ui/field";
import { RadioGroupPrimitive, RadioPrimitive } from "@lms/ui/radio-group";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectPrimitive,
  SelectTrigger,
  SelectValue,
} from "@lms/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@lms/ui/segmented-control";
import { Skeleton } from "@lms/ui/skeleton";
import { ScrollArea } from "@lms/ui/scroll-area";
import { Toggle } from "@lms/ui/toggle";
import { ToggleGroup } from "@lms/ui/toggle-group";
import { Textarea } from "@lms/ui/textarea";
import { orpc, type client } from "#lib/orpc.ts";
import { useLocalTimezone } from "#lib/use-local-timezone.ts";
import {
  availableSlots,
  bookingWindow,
  calendarDate,
  calendarEvent,
  firstAvailableDate,
  formatBookingDate,
  formatBookingTime,
  CONSULTATION_DURATIONS,
} from "#lib/consultation-scheduling.ts";

export type Consultation = Omit<
  Awaited<ReturnType<typeof client.consultation.create>>,
  "emailSent"
> & {
  emailSent?: boolean;
  teacherEmail?: string | null;
  teacherName?: string | null;
  teacherAvatarUrl?: string | null;
  studentAvatarUrl?: string | null;
};
export type BookingFlow =
  | { mode: "book" }
  | { mode: "rebook" | "reschedule"; consultation: Consultation };
export type BookingDetails = {
  enrolmentId?: string;
  teacherId: string;
  reason: string;
  scheduledAt: string;
  durationMinutes: number;
};

type BookingFormValues = {
  enrolmentId: string;
  reason: string;
  teacherId: string | null;
  durationMinutes: number;
  scheduledAt: string | null;
};

const noSlots: string[] = [];

const durationItems = CONSULTATION_DURATIONS.map((duration) => ({
  value: duration.minutes,
  label: duration.label,
}));

type SchedulerProps = {
  teachers: { id: string; email: string }[];
  bookingForStudents?: boolean;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  flow: BookingFlow;
  onSave: (details: BookingDetails) => Promise<Consultation | null>;
};

export function ConsultationScheduler(props: SchedulerProps) {
  const timeZone = useLocalTimezone();
  if (!timeZone)
    return (
      <Skeleton className="h-[460px] w-full rounded-xl" aria-label="Loading booking calendar" />
    );
  return <Scheduler {...props} timeZone={timeZone} />;
}

function Scheduler({
  flow,
  onSave,
  timeZone,
  teachers,
  bookingForStudents = false,
  headingRef,
}: SchedulerProps & { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  const original = flow.mode === "book" ? undefined : flow.consultation;
  const {
    handleSubmit,
    control,
    setValue,
    formState: { isSubmitting: pending },
  } = useForm<BookingFormValues>({
    defaultValues: {
      enrolmentId: "",
      reason: original?.reason ?? "",
      teacherId: teachers.some((teacher) => teacher.id === original?.teacherId)
        ? original!.teacherId
        : teachers.length === 1
          ? teachers[0]!.id
          : null,
      durationMinutes: original?.durationMinutes ?? 60,
      scheduledAt: null,
    },
  });
  const [durationMinutes, teacherId, slot] = useWatch({
    control,
    name: ["durationMinutes", "teacherId", "scheduledAt"],
  });
  const [chosenDay, setChosenDay] = useState<Date | null>(null);
  const [viewedMonth, setViewedMonth] = useState<Date | null>(null);
  const [hour12, setHour12] = useState(true);
  const [step, setStep] = useState<"duration" | "time" | "details" | "confirmed">(
    flow.mode === "reschedule" ? "time" : "duration",
  );
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Consultation | null>(null);
  const localHeading = useRef<HTMLHeadingElement>(null);
  const stepHeading = headingRef ?? localHeading;
  const previousStep = useRef(step);
  const rescheduling = flow.mode === "reschedule";
  const availability = useQuery(
    orpc.consultation.availability.slots.queryOptions({
      input: {
        teacherId: teacherId ?? "",
        durationMinutes: durationMinutes as 30 | 60 | 120,
        consultationId: rescheduling ? original?.id : undefined,
      },
      enabled: !!teacherId,
      refetchInterval: 60_000,
    }),
  );
  const publishedSlots = availability.isError ? noSlots : (availability.data?.slots ?? noSlots);
  const availableDays = useMemo(
    () =>
      new Set(
        publishedSlots
          .filter((value) => new Date(value).getTime() >= now.getTime() + 60 * 60_000)
          .map((value) => calendarDate(new Date(value), timeZone).getTime()),
      ),
    [publishedSlots, timeZone, now],
  );
  const day =
    chosenDay && availableDays.has(chosenDay.getTime())
      ? chosenDay
      : firstAvailableDate(now, timeZone, publishedSlots);
  const month = viewedMonth ?? day;
  const window = bookingWindow(now, timeZone);
  const slots = availableSlots(day, timeZone, now, publishedSlots).filter(
    (value) =>
      !rescheduling ||
      teacherId !== original?.teacherId ||
      value.getTime() !== original?.scheduledAt.getTime() ||
      durationMinutes !== original?.durationMinutes,
  );
  const selectedSlot = slot ? new Date(slot) : null;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step, stepHeading]);

  function changeDuration(value: number) {
    if (!CONSULTATION_DURATIONS.some((duration) => duration.minutes === value)) return;
    setValue("durationMinutes", value);
    setChosenDay(null);
    setViewedMonth(null);
    setValue("scheduledAt", null);
    setError("");
  }

  function changeTeacher(value: string | null) {
    if (pending || value === teacherId) return;
    setValue("teacherId", value);
    setChosenDay(null);
    setViewedMonth(null);
    setValue("scheduledAt", null);
    setError("");
    if (step === "details") setStep("time");
  }

  async function submit(values: BookingFormValues) {
    if (step !== "details") return;
    if (
      !slot ||
      !availableSlots(day, timeZone, new Date(), publishedSlots).some(
        (value) => value.toISOString() === slot,
      )
    ) {
      setError("That time is no longer within the booking window. Please choose another time.");
      setStep("time");
      setValue("scheduledAt", null);
      return;
    }
    const details = {
      enrolmentId: values.enrolmentId || undefined,
      reason: rescheduling ? original!.reason : values.reason,
      teacherId: values.teacherId ?? "",
      scheduledAt: slot,
      durationMinutes: values.durationMinutes,
    };
    if (!teachers.some((teacher) => teacher.id === details.teacherId)) {
      setError("Choose a teacher who has enrolled you.");
      return;
    }
    if (bookingForStudents && !rescheduling && !details.enrolmentId) {
      setError("Choose an enrolled student.");
      return;
    }
    if (!rescheduling && !details.reason) {
      setError("Enter discussion notes for the consultation.");
      return;
    }
    setError("");
    try {
      const result = await onSave(details);
      if (result) {
        setConfirmed({
          ...result,
          teacherEmail: teachers.find((teacher) => teacher.id === details.teacherId)?.email,
        });
        setStep("confirmed");
      } else {
        setError("We couldn’t confirm the booking. Please try again.");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Couldn’t save the booking. Please try again.",
      );
      setValue("scheduledAt", null);
      setStep("time");
      void availability.refetch();
    }
  }

  const title = {
    duration: "Consultation duration",
    time: "Date and time",
    confirmed: rescheduling ? "Consultation rescheduled" : "Booking confirmed",
    details: rescheduling ? "Reschedule consultation" : "Consultation details",
  }[step];
  const header = (
    <DialogHeader className="shrink-0 border-b pe-14">
      <DialogTitle ref={stepHeading} tabIndex={-1} className="outline-none">
        {title}
      </DialogTitle>
      {step !== "confirmed" && (
        <DialogDescription>
          {step === "duration" ? (
            "Choose a length to see available dates and times."
          ) : step === "time" ? (
            <>
              Choose a date and time for your{" "}
              <Select
                items={durationItems}
                value={durationMinutes}
                onValueChange={(value) => {
                  if (value !== null) changeDuration(value);
                }}
              >
                <SelectPrimitive.Trigger
                  aria-label={`Consultation length: ${durationMinutes} minutes`}
                  render={
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto gap-1 px-0 py-0 align-baseline"
                    />
                  }
                >
                  <span className="underline underline-offset-4">
                    <SelectValue>
                      {durationMinutes === 30 ? "30-minute" : `${durationMinutes / 60}-hour`}
                    </SelectValue>{" "}
                    consultation
                  </span>
                  <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
                </SelectPrimitive.Trigger>
                <SelectPopup>
                  <SelectGroup>
                    {durationItems.map((duration) => (
                      <SelectItem key={duration.value} value={duration.value}>
                        {duration.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectPopup>
              </Select>
            </>
          ) : selectedSlot ? (
            <>
              <time dateTime={slot!}>
                {formatBookingDate(selectedSlot, timeZone)} ·{" "}
                {formatBookingTime(selectedSlot, timeZone, hour12)}
              </time>{" "}
              · {durationMinutes} minutes
            </>
          ) : null}
        </DialogDescription>
      )}
    </DialogHeader>
  );
  if (confirmed && step === "confirmed") {
    const emailNotice =
      confirmed.emailSent === false ? (
        <Alert variant="warning">
          <AlertDescription>
            Your booking is saved, but some calendar emails couldn’t be sent. Use Resend calendar
            email in the consultation’s actions to try again.
          </AlertDescription>
        </Alert>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Calendar invitations have been emailed to the student and teacher.
        </p>
      );
    const calendarButton = (
      <Button
        variant="outline"
        render={
          <a
            download="contour-consultation.ics"
            href={`data:text/calendar;charset=utf-8,${encodeURIComponent(calendarEvent(confirmed.id, confirmed.scheduledAt, confirmed.durationMinutes))}`}
          />
        }
      >
        Add to calendar
      </Button>
    );

    return (
      <>
        <DialogHeader className="pe-14">
          <DialogTitle ref={stepHeading} tabIndex={-1} className="outline-none">
            {title}
          </DialogTitle>
          <DialogDescription>
            <time dateTime={confirmed.scheduledAt.toISOString()}>
              {formatBookingDate(confirmed.scheduledAt, timeZone)} ·{" "}
              {formatBookingTime(confirmed.scheduledAt, timeZone, hour12)}
            </time>
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>{emailNotice}</DialogPanel>
        <DialogFooter>
          {calendarButton}
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      {header}
      <form noValidate onSubmit={(event) => void handleSubmit(submit)(event)} className="contents">
        <DialogPanel className="@container min-h-0 p-0 in-[[data-slot=dialog-popup]:has([data-slot=dialog-header])]:pt-0">
          {original && (
            <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 px-5 py-3 text-sm sm:px-6">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="font-medium whitespace-nowrap">
                    {rescheduling ? "Current booking" : "Previous consultation"}
                  </p>
                  <p className="text-muted-foreground">
                    {formatBookingDate(original.scheduledAt, timeZone)} ·{" "}
                    {formatBookingTime(original.scheduledAt, timeZone, hour12)}
                  </p>
                </div>
                <p className="line-clamp-2 max-w-xl break-words text-muted-foreground">
                  {original.reason}
                </p>
              </div>
            </div>
          )}
          {step === "duration" ? (
            <section className="p-6 sm:py-10" aria-label="Consultation length">
              <div className="grid gap-3 sm:grid-cols-3">
                {CONSULTATION_DURATIONS.map((duration) => (
                  <Button
                    key={duration.minutes}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-28 flex-col gap-3 py-6"
                    onClick={() => {
                      changeDuration(duration.minutes);
                      setStep("time");
                    }}
                  >
                    <Clock3Icon aria-hidden="true" />
                    {duration.label}
                  </Button>
                ))}
              </div>
            </section>
          ) : step === "time" ? (
            <>
              {!bookingForStudents && teachers.length > 1 && (
                <div className="border-b p-6">
                  <TeacherSelect
                    teachers={teachers}
                    value={teacherId}
                    onValueChange={changeTeacher}
                  />
                </div>
              )}
              {teacherId && availability.isError && (
                <Alert variant="error" className="m-6 w-auto">
                  <AlertDescription>
                    Couldn’t load available times.{" "}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void availability.refetch()}
                    >
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <section className="grid sm:grid-cols-2" aria-label="Choose a date and time">
                <div className="@container min-w-0 p-6">
                  <Calendar
                    className="w-full [--cell-size:calc(100cqw/7)] sm:[--cell-size:calc(100cqw/7)] [&_table]:w-full [&_table]:border-collapse"
                    mode="single"
                    required
                    selected={day}
                    month={month}
                    onMonthChange={setViewedMonth}
                    onSelect={(value) => {
                      if (value) {
                        setChosenDay(value);
                        setValue("scheduledAt", null);
                        setError("");
                      }
                    }}
                    disabled={(value) => !availableDays.has(value.getTime())}
                    startMonth={window.start}
                    endMonth={window.end}
                    fixedWeeks
                    showOutsideDays={false}
                    weekStartsOn={1}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-4 border-t p-6 sm:border-t-0 sm:border-s">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">
                      {day.toLocaleDateString("en-AU", {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                    </h3>
                    <SegmentedControl
                      aria-label="Time format"
                      className="shrink-0"
                      size="sm"
                      render={
                        <RadioGroupPrimitive
                          value={hour12 ? "12" : "24"}
                          onValueChange={(value) => setHour12(value === "12")}
                        />
                      }
                    >
                      <SegmentedControlItem
                        render={<RadioPrimitive.Root value="12" aria-label="12-hour time" />}
                      >
                        12h
                      </SegmentedControlItem>
                      <SegmentedControlItem
                        render={<RadioPrimitive.Root value="24" aria-label="24-hour time" />}
                      >
                        24h
                      </SegmentedControlItem>
                    </SegmentedControl>
                  </div>
                  <div className="relative min-h-40 flex-1 max-sm:h-48 max-sm:flex-none">
                    <div className="absolute inset-0">
                      <ScrollArea overscrollContain scrollbarGutter scrollFade>
                        <div className="pb-1">
                          <ToggleGroup
                            aria-label="Consultation time"
                            className="grid w-full grid-cols-1 gap-1.5"
                            value={slot ? [slot] : []}
                            onValueChange={(values) => {
                              const value = values[0];
                              if (!value) return;
                              setValue("scheduledAt", String(value));
                              setError("");
                              setStep("details");
                            }}
                          >
                            {slots.map((value) => (
                              <Toggle
                                key={value.toISOString()}
                                type="button"
                                size="sm"
                                value={value.toISOString()}
                                variant="outline"
                              >
                                {formatBookingTime(value, timeZone, hour12)}
                              </Toggle>
                            ))}
                          </ToggleGroup>
                          {slots.length === 0 && (
                            <p role="status" className="text-sm text-muted-foreground">
                              {!teacherId
                                ? "Choose a teacher to see available times."
                                : availability.isPending
                                  ? "Loading available times…"
                                  : availability.isError
                                    ? "Available times could not be loaded."
                                    : publishedSlots.length === 0
                                      ? "This teacher has no available times for this duration in the next 90 days. Try a shorter consultation or contact your teacher."
                                      : "No times on this date. Choose another day."}
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              </section>
              {error && (
                <Alert variant="error" className="mx-5 mb-5 w-auto">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 p-6 sm:p-8">
              {!rescheduling || !bookingForStudents ? (
                <fieldset disabled={pending}>
                  <legend className="sr-only">{bookingForStudents ? "Student" : "Teacher"}</legend>
                  {bookingForStudents ? (
                    <StudentSelect control={control} />
                  ) : (
                    <TeacherSelect
                      teachers={teachers}
                      value={teacherId}
                      onValueChange={changeTeacher}
                    />
                  )}
                </fieldset>
              ) : null}
              {rescheduling ? (
                <div className="flex flex-col gap-3 text-sm">
                  {bookingForStudents && (
                    <p className="font-medium">
                      {original?.firstName} {original?.lastName}
                    </p>
                  )}
                  <p className="break-words whitespace-pre-wrap text-muted-foreground">
                    {original?.reason}
                  </p>
                  <p className="text-muted-foreground">
                    Confirming replaces your current booking time.
                  </p>
                </div>
              ) : (
                <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5">
                  <legend className="sr-only">Consultation details</legend>
                  <Controller
                    control={control}
                    name="reason"
                    rules={{
                      required: "Enter discussion notes for the consultation.",
                      maxLength: {
                        value: 2000,
                        message: "Keep discussion notes under 2,000 characters.",
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <Field name={field.name} invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="booking-reason">Discussion notes</FieldLabel>
                        <Textarea
                          {...field}
                          id="booking-reason"
                          aria-invalid={fieldState.invalid}
                          required
                          maxLength={2000}
                          placeholder="Add a topic or question"
                        />
                        <FieldError match={fieldState.invalid}>
                          {fieldState.error?.message}
                        </FieldError>
                      </Field>
                    )}
                  />
                </fieldset>
              )}
              {error && (
                <Alert variant="error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </DialogPanel>
        <DialogFooter className="flex shrink-0 flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {step === "details" && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setError("");
                  setValue("scheduledAt", null);
                  setStep("time");
                }}
              >
                <ArrowLeftIcon aria-hidden="true" /> Back
              </Button>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
              Cancel
            </DialogClose>
            {step === "details" && (
              <Button
                type="submit"
                loading={pending}
                disabled={!slots.some((value) => value.toISOString() === slot)}
              >
                {rescheduling ? "Confirm new time" : "Confirm booking"}
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </form>
    </>
  );
}

function StudentSelect({ control }: { control: Control<BookingFormValues> }) {
  const {
    field: { ref, onBlur, ...field },
    fieldState,
  } = useController({
    control,
    name: "enrolmentId",
    rules: { required: "Choose an enrolled student." },
  });
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
        label: student.studentName
          ? `${student.studentName} · ${student.studentEmail}`
          : student.studentEmail,
      })) ?? [];

  return (
    <Field name="enrolmentId" invalid={fieldState.invalid}>
      <FieldLabel>Student</FieldLabel>
      <Select
        name={field.name}
        items={items}
        value={field.value || null}
        onValueChange={(value) => field.onChange(value ?? "")}
        required
        disabled={query.isPending || (!query.data && query.isError)}
      >
        <SelectTrigger ref={ref} onBlur={onBlur} aria-invalid={fieldState.invalid}>
          <SelectValue
            placeholder={query.isPending ? "Loading students…" : "Choose an enrolled student"}
          />
        </SelectTrigger>
        <SelectPopup>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
      <FieldError match={fieldState.invalid}>{fieldState.error?.message}</FieldError>
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
      ) : null}
    </Field>
  );
}

function TeacherSelect({
  teachers,
  value,
  onValueChange,
}: {
  teachers: { id: string; email: string }[];
  value: string | null;
  onValueChange: (value: string | null) => void;
}) {
  const items = teachers.map((teacher) => ({ label: teacher.email, value: teacher.id }));
  return (
    <Field name="teacherId">
      <FieldLabel>Teacher</FieldLabel>
      <Select name="teacherId" items={items} value={value} onValueChange={onValueChange} required>
        <SelectTrigger>
          <SelectValue placeholder="Choose your teacher" />
        </SelectTrigger>
        <SelectPopup>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
    </Field>
  );
}
