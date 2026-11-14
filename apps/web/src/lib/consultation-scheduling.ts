import { BOOKING_WINDOW_DAYS, NOTICE_MINUTES } from "@lms/api/consultation-scheduling";
export const CONSULTATION_DURATIONS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
] as const;
const MINUTE = 60_000;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string) {
  const existing = dateFormatters.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  dateFormatters.set(timeZone, formatter);
  return formatter;
}

/** Calendar values are floating local dates; slot values are absolute instants. */
export function calendarDate(instant: Date, timeZone: string): Date {
  const parts = dateFormatter(timeZone).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((value) => value.type === type)?.value);
  return new Date(part("year"), part("month") - 1, part("day"));
}

export function bookingWindow(now: Date, timeZone: string) {
  const start = calendarDate(now, timeZone);
  const end = new Date(start);
  end.setDate(end.getDate() + BOOKING_WINDOW_DAYS);
  return { start, end };
}

/** Display only the selected teacher's server-validated slots in the viewer's timezone. */
export function availableSlots(
  day: Date,
  timeZone: string,
  now: Date,
  publishedSlots: readonly string[],
): Date[] {
  const { start, end } = bookingWindow(now, timeZone);
  if (day < start || day > end) return [];
  return publishedSlots
    .map((value) => new Date(value))
    .filter((slot) => {
      if (slot.getTime() < now.getTime() + NOTICE_MINUTES * MINUTE) return false;
      return calendarDate(slot, timeZone).getTime() === day.getTime();
    });
}

export function firstAvailableDate(
  now: Date,
  timeZone: string,
  publishedSlots: readonly string[],
): Date {
  const first = publishedSlots.find(
    (value) => new Date(value).getTime() >= now.getTime() + NOTICE_MINUTES * MINUTE,
  );
  return calendarDate(first ? new Date(first) : now, timeZone);
}

export function formatBookingTime(date: Date, timeZone: string, hour12 = true) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  }).format(date);
}

export function formatBookingDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
