"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckIcon,
  Clock3Icon,
  DownloadIcon,
  GlobeIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@lms/ui/alert";
import { Button } from "@lms/ui/button";
import { Calendar } from "@lms/ui/calendar";
import { Field, FieldLabel } from "@lms/ui/field";
import { Input } from "@lms/ui/input";
import { RadioGroup, RadioGroupPrimitive, RadioPrimitive } from "@lms/ui/radio-group";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@lms/ui/select";
import { SegmentedControl, SegmentedControlItem } from "@lms/ui/segmented-control";
import { Separator } from "@lms/ui/separator";
import { Skeleton } from "@lms/ui/skeleton";
import { Textarea } from "@lms/ui/textarea";
import type { client } from "#lib/orpc.ts";
import { formText } from "#lib/form.ts";
import { useLocalTimezone } from "#lib/use-local-timezone.ts";
import { StudentSelect } from "#components/student-select.tsx";
import { TeacherSelect } from "#components/teacher-select.tsx";
import {
  availableSlots,
  bookingWindow,
  calendarDate,
  calendarEvent,
  firstAvailableDate,
  formatBookingDate,
  formatBookingTime,
  SESSION_MINUTES,
} from "#lib/consultation-scheduling.ts";

export type Consultation = Awaited<ReturnType<typeof client.consultation.create>> & {
  teacherEmail?: string | null;
};
export type BookingFlow =
  | { mode: "book" }
  | { mode: "rebook" | "reschedule"; consultation: Consultation };
export type BookingDetails = {
  enrolmentId?: string;
  teacherId: string;
  firstName: string;
  lastName: string;
  reason: string;
  scheduledAt: string;
};

const timeZones = [
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Hobart",
  "Australia/Melbourne",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export function ConsultationScheduler(props: {
  teachers: { id: string; email: string }[];
  bookingForStudents?: boolean;
  flow: BookingFlow;
  onSave: (details: BookingDetails) => Promise<Consultation | null>;
  onReset: () => void;
}) {
  const localZone = useLocalTimezone();
  if (!localZone)
    return (
      <Skeleton className="h-[460px] w-full rounded-xl" aria-label="Loading booking calendar" />
    );
  return <Scheduler {...props} localZone={localZone} />;
}

function Scheduler({
  flow,
  onSave,
  onReset,
  localZone,
  teachers,
  bookingForStudents = false,
}: {
  teachers: { id: string; email: string }[];
  bookingForStudents?: boolean;
  flow: BookingFlow;
  localZone: string;
  onSave: (details: BookingDetails) => Promise<Consultation | null>;
  onReset: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState(localZone);
  const [day, setDay] = useState(() => firstAvailableDate(now, localZone));
  const [month, setMonth] = useState(day);
  const [slot, setSlot] = useState<string | null>(null);
  const [hour12, setHour12] = useState(true);
  const [step, setStep] = useState<"time" | "details" | "confirmed">("time");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Consultation | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const original = flow.mode === "book" ? undefined : flow.consultation;
  const rescheduling = flow.mode === "reschedule";
  const detailsForm = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState({
    enrolmentId: undefined as string | undefined,
    firstName: original?.firstName ?? "",
    lastName: original?.lastName ?? "",
    reason: original?.reason ?? "",
    teacherId: original?.teacherId ?? (teachers.length === 1 ? teachers[0]!.id : null),
  });
  const window = bookingWindow(now, timeZone);
  const slots = availableSlots(day, timeZone, now).filter(
    (value) => !rescheduling || value.getTime() !== original?.scheduledAt.getTime(),
  );
  const selectedSlot = slot ? new Date(slot) : null;
  const validSlot = slots.some((value) => value.toISOString() === slot);
  const zoneItems = [...new Set([localZone, ...timeZones])].map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  }));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);

  function changeTimeZone(value: string | null) {
    if (!value) return;
    setTimeZone(value);
    const nextDay = selectedSlot
      ? calendarDate(selectedSlot, value)
      : firstAvailableDate(now, value);
    setDay(nextDay);
    setMonth(nextDay);
    setError("");
  }

  function readDraft(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      enrolmentId: formText(data, "enrolmentId") || undefined,
      teacherId: formText(data, "teacherId") || null,
      firstName: rescheduling ? original!.firstName : formText(data, "firstName"),
      lastName: rescheduling ? original!.lastName : formText(data, "lastName"),
      reason: rescheduling ? original!.reason : formText(data, "reason"),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextDraft = readDraft(event.currentTarget);
    setDraft(nextDraft);
    if (
      !slot ||
      !availableSlots(day, timeZone, new Date()).some((value) => value.toISOString() === slot)
    ) {
      setError("That time is no longer within the booking window. Please choose another time.");
      setStep("time");
      setSlot(null);
      return;
    }
    const details = {
      ...nextDraft,
      teacherId: nextDraft.teacherId ?? "",
      scheduledAt: slot,
    };
    if (!teachers.some((teacher) => teacher.id === details.teacherId)) {
      setError("Choose a teacher who has enrolled you.");
      return;
    }
    if (bookingForStudents && !details.enrolmentId) {
      setError("Choose an enrolled student.");
      return;
    }
    if (!details.firstName || !details.lastName || !details.reason) {
      setError(
        bookingForStudents
          ? "Enter the student’s name and a reason for the consultation."
          : "Please enter your name and a reason for the consultation.",
      );
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await onSave(details);
      if (result) {
        setConfirmed({
          ...result,
          teacherEmail: teachers.find((teacher) => teacher.id === details.teacherId)?.email,
        });
        setStep("confirmed");
      } else {
        setError("We couldn’t confirm the save. Refresh your bookings before trying again.");
      }
    } finally {
      setPending(false);
    }
  }

  if (confirmed && step === "confirmed") {
    return (
      <div className="flex flex-col items-center gap-6 rounded-xl border bg-card px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-success/8 text-success-foreground">
          <CalendarCheckIcon className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2" role="status">
          <h2
            ref={stepHeading}
            tabIndex={-1}
            className="text-2xl font-semibold tracking-tight outline-none"
          >
            {rescheduling ? "Rescheduled" : "Booking confirmed"}
          </h2>
        </div>
        <dl className="flex w-full max-w-md flex-col gap-4 rounded-lg border p-5 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Consultation</dt>
            <dd className="font-medium">One-to-one · {SESSION_MINUTES} min</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">When</dt>
            <dd className="text-right">
              <time dateTime={confirmed.scheduledAt.toISOString()}>
                {formatBookingDate(confirmed.scheduledAt, timeZone)}
                <br />
                {formatBookingTime(confirmed.scheduledAt, timeZone, hour12)}
              </time>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Timezone</dt>
            <dd className="break-all text-right">{timeZone.replaceAll("_", " ")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Attendee</dt>
            <dd className="min-w-0 break-words text-right">
              {confirmed.firstName} {confirmed.lastName}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Teacher</dt>
            <dd className="min-w-0 break-all text-right">{confirmed.teacherEmail}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            variant="outline"
            render={
              <a
                download="contour-consultation.ics"
                href={`data:text/calendar;charset=utf-8,${encodeURIComponent(calendarEvent(confirmed.id, confirmed.scheduledAt))}`}
              />
            }
          >
            <DownloadIcon aria-hidden="true" /> Add to calendar
          </Button>
          <Button onClick={onReset}>
            Book another <ArrowRightIcon aria-hidden="true" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Calendar downloads do not update automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="@container overflow-hidden rounded-xl border bg-card shadow-xs/5">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:px-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            {rescheduling
              ? "Reschedule consultation"
              : flow.mode === "rebook"
                ? "Follow-up consultation"
                : "30 min consultation"}
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3Icon className="size-4" aria-hidden="true" />
            {SESSION_MINUTES} minutes · One-to-one
          </p>
        </div>
        <ol aria-label="Booking progress" className="flex items-center gap-2 text-xs">
          <li
            aria-current={step === "time" ? "step" : undefined}
            className={step === "time" ? "font-medium" : "text-muted-foreground"}
          >
            1. Date & time
          </li>
          <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />
          <li
            aria-current={step === "details" ? "step" : undefined}
            className={step === "details" ? "font-medium" : "text-muted-foreground"}
          >
            2. {rescheduling ? "Confirm" : bookingForStudents ? "Student details" : "Your details"}
          </li>
        </ol>
      </header>
      {original && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/25 px-5 py-3 text-sm sm:px-6">
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {rescheduling ? "Current booking" : "Previous consultation"}
            </p>
            <p className="text-muted-foreground">
              {formatBookingDate(original.scheduledAt, timeZone)} ·{" "}
              {formatBookingTime(original.scheduledAt, timeZone, hour12)}
            </p>
            <p className="line-clamp-2 max-w-xl break-words text-muted-foreground">
              {original.reason}
            </p>
          </div>
          {rescheduling && (
            <p className="text-xs text-muted-foreground">
              Your current time stays booked until you confirm.
            </p>
          )}
        </div>
      )}
      {step === "time" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
            <Field className="min-w-0 max-w-full">
              <FieldLabel className="sr-only">Timezone</FieldLabel>
              <Select items={zoneItems} value={timeZone} onValueChange={changeTimeZone}>
                <SelectTrigger className="w-fit min-w-0 max-w-full gap-2" size="sm">
                  <GlobeIcon aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  <SelectGroup>
                    {zoneItems.map((zone) => (
                      <SelectItem key={zone.value} value={zone.value}>
                        {zone.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectPopup>
              </Select>
            </Field>
            <SegmentedControl
              aria-label="Time format"
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
          <div className="grid @min-[640px]:grid-cols-[minmax(0,1fr)_minmax(15rem,0.65fr)]">
            <section aria-label="Choose a date" className="flex min-w-0 flex-col gap-4 p-4 sm:p-6">
              <h3 ref={stepHeading} tabIndex={-1} className="sr-only outline-none">
                Choose a date
              </h3>
              <Calendar
                mode="single"
                required
                selected={day}
                month={month}
                onMonthChange={setMonth}
                onSelect={(value) => {
                  if (value) {
                    setDay(value);
                    setSlot(null);
                    setError("");
                  }
                }}
                disabled={(value) => availableSlots(value, timeZone, now).length === 0}
                startMonth={window.start}
                endMonth={window.end}
                fixedWeeks
                showOutsideDays={false}
                weekStartsOn={1}
                className="w-full [--cell-size:clamp(2.25rem,6cqw,4rem)] sm:[--cell-size:clamp(2.25rem,6cqw,4rem)] [&_table]:w-full [&_table]:table-fixed"
                classNames={{
                  month_caption: "mx-0 mb-4 h-10 justify-start pe-20",
                  caption_label: "text-lg font-semibold sm:text-lg",
                  nav: "start-auto end-0 w-auto gap-1",
                  button_previous: "size-9",
                  button_next: "size-9",
                  weekday: "h-8 text-[10px] uppercase",
                  day: "w-auto p-0.5 [&:not([data-disabled]):not([data-selected])>button]:bg-muted/70",
                  day_button: "w-full in-data-disabled:no-underline",
                }}
              />
            </section>
            <section
              aria-label="Choose a time"
              className="flex min-w-0 flex-col gap-4 border-t p-5 @min-[640px]:border-t-0 @min-[640px]:border-l sm:p-6"
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold">
                  {day.toLocaleDateString("en-AU", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </h3>
                <p aria-live="polite" className="text-xs text-muted-foreground">
                  {slots.length} {slots.length === 1 ? "time" : "times"}
                </p>
              </div>
              <RadioGroup
                aria-label="Consultation time"
                value={slot ?? ""}
                onValueChange={(value) => setSlot(String(value))}
                className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-1 @min-[640px]:max-h-[26rem] @min-[640px]:grid-cols-1"
              >
                {slots.map((value) => (
                  <RadioPrimitive.Root
                    key={value.toISOString()}
                    value={value.toISOString()}
                    render={<Button type="button" variant="outline" size="lg" />}
                    className="h-11 w-full gap-2 tabular-nums data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-success-foreground"
                    />
                    {formatBookingTime(value, timeZone, hour12)}
                    {slot === value.toISOString() && <CheckIcon aria-hidden="true" />}
                  </RadioPrimitive.Root>
                ))}
              </RadioGroup>
              {slots.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No times on this date. Choose another day.
                </p>
              )}
            </section>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-1">
              <p role="status" className="text-sm font-medium">
                {validSlot && selectedSlot
                  ? `${formatBookingDate(selectedSlot, timeZone)} · ${formatBookingTime(selectedSlot, timeZone, hour12)}`
                  : "Select a time to continue"}
              </p>
              <p className="text-xs text-muted-foreground">
                Example availability · Calendar conflicts are not checked.
              </p>
            </div>
            <Button
              type="button"
              disabled={!validSlot}
              size="lg"
              onClick={() => {
                setError("");
                setStep("details");
              }}
            >
              Continue <ArrowRightIcon aria-hidden="true" />
            </Button>
          </div>
          {error && (
            <Alert variant="error" className="mx-5 mb-5 w-auto">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </>
      ) : (
        <form
          ref={detailsForm}
          onSubmit={(event) => void submit(event)}
          className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 p-6 sm:p-8"
        >
          <div className="flex flex-col gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={pending}
              onClick={() => {
                if (detailsForm.current) {
                  setDraft(readDraft(detailsForm.current));
                }
                setStep("time");
              }}
            >
              <ArrowLeftIcon aria-hidden="true" /> Change date or time
            </Button>
            <div className="flex flex-col gap-2">
              <h3
                ref={stepHeading}
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight outline-none"
              >
                {rescheduling
                  ? "Confirm your new time"
                  : bookingForStudents
                    ? "Student consultation details"
                    : "A few details, then you’re in."}
              </h3>
              {selectedSlot && (
                <p className="text-sm text-muted-foreground">
                  <time dateTime={slot!}>
                    {formatBookingDate(selectedSlot, timeZone)} ·{" "}
                    {formatBookingTime(selectedSlot, timeZone, hour12)}
                  </time>
                  <br />
                  {timeZone.replaceAll("_", " ")} · {SESSION_MINUTES} minutes
                </p>
              )}
            </div>
          </div>
          <Separator />
          {bookingForStudents ? (
            <fieldset disabled={pending}>
              <legend className="sr-only">Student</legend>
              <input type="hidden" name="teacherId" value={teachers[0]?.id ?? ""} />
              <StudentSelect defaultValue={draft.enrolmentId} />
            </fieldset>
          ) : (
            <fieldset disabled={pending}>
              <legend className="sr-only">Your teacher</legend>
              <TeacherSelect
                teachers={teachers}
                defaultValue={
                  teachers.some((teacher) => teacher.id === draft.teacherId)
                    ? draft.teacherId
                    : null
                }
              />
            </fieldset>
          )}
          {rescheduling ? (
            <div className="flex flex-col gap-3 text-sm">
              <p className="font-medium">
                {original?.firstName} {original?.lastName}
              </p>
              <p className="break-words whitespace-pre-wrap text-muted-foreground">
                {original?.reason}
              </p>
              <p className="text-muted-foreground">
                Confirming replaces your current booking time.
              </p>
            </div>
          ) : (
            <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5">
              <legend className="sr-only">Your consultation details</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>
                    {bookingForStudents ? "Student first name" : "First name"}
                  </FieldLabel>
                  <Input
                    type="text"
                    name="firstName"
                    defaultValue={draft.firstName}
                    autoComplete={bookingForStudents ? "off" : "given-name"}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field>
                  <FieldLabel>{bookingForStudents ? "Student last name" : "Last name"}</FieldLabel>
                  <Input
                    type="text"
                    name="lastName"
                    defaultValue={draft.lastName}
                    autoComplete={bookingForStudents ? "off" : "family-name"}
                    required
                    maxLength={100}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel>What would you like to discuss?</FieldLabel>
                <Textarea
                  name="reason"
                  defaultValue={draft.reason}
                  required
                  maxLength={2000}
                  placeholder="Reason for consultation"
                />
              </Field>
            </fieldset>
          )}
          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-64 text-xs leading-relaxed text-muted-foreground">
              {flow.mode === "rebook" ? "Creates a new booking." : ""}
            </p>
            <Button type="submit" loading={pending} size="lg">
              {rescheduling ? "Confirm new time" : "Confirm booking"}
              <ArrowRightIcon aria-hidden="true" />
            </Button>
          </div>
        </form>
      )}
      {flow.mode !== "book" && (
        <div className="border-t px-5 py-3">
          <Button variant="ghost" size="sm" disabled={pending} onClick={onReset}>
            {rescheduling ? "Keep current booking" : "Cancel rebooking"}
          </Button>
        </div>
      )}
    </div>
  );
}
