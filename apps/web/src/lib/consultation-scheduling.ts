/** Prototype availability. Replace this with a server availability endpoint before launch. */
export const SESSION_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 90;
export const NOTICE_MINUTES = 60;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const PERTH_OFFSET = 8 * 60 * MINUTE;

function dateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

export function availableSlots(day: Date, timeZone: string, now: Date): Date[] {
  const { start, end } = bookingWindow(now, timeZone);
  if (day < start || day > end) return [];
  const formatter = dateFormatter(timeZone);
  // Build the requested key without assuming noon UTC is the same date in every zone.
  const keyParts = formatter.formatToParts(new Date(0));
  const requestedKey = keyParts
    .map((part) => {
      if (part.type === "year") return String(day.getFullYear());
      if (part.type === "month") return String(day.getMonth() + 1).padStart(2, "0");
      if (part.type === "day") return String(day.getDate()).padStart(2, "0");
      return part.value;
    })
    .join("");
  const nominalMidnight = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  const slots: Date[] = [];
  // Covers UTC-12 through UTC+14, including 23/25-hour DST days.
  for (
    let time = nominalMidnight - 14 * 60 * MINUTE;
    time < nominalMidnight + DAY + 12 * 60 * MINUTE;
    time += SESSION_MINUTES * MINUTE
  ) {
    if (time < now.getTime() + NOTICE_MINUTES * MINUTE) continue;
    const perth = new Date(time + PERTH_OFFSET);
    if (perth.getUTCDay() === 0 || perth.getUTCDay() === 6) continue;
    if (perth.getUTCHours() < 9 || perth.getUTCHours() >= 17) continue;
    const slot = new Date(time);
    if (formatter.format(slot) === requestedKey) slots.push(slot);
  }
  return slots;
}

export function firstAvailableDate(now: Date, timeZone: string): Date {
  const day = calendarDate(now, timeZone);
  for (let offset = 0; offset < 8; offset++) {
    if (availableSlots(day, timeZone, now).length > 0) return day;
    day.setDate(day.getDate() + 1);
  }
  return day;
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

export function calendarEvent(id: string, scheduledAt: Date) {
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Contour//Consultations//EN",
    "BEGIN:VEVENT",
    `UID:${id}@contour`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(scheduledAt)}`,
    `DTEND:${stamp(new Date(scheduledAt.getTime() + SESSION_MINUTES * MINUTE))}`,
    "SUMMARY:Contour consultation",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
