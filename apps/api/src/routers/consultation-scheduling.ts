export const SESSION_MINUTES = 30;
export const NOTICE_MINUTES = 60;
export const BOOKING_WINDOW_DAYS = 90;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(timeZone: string) {
  try {
    // Accept named zones, not a fixed offset that would ignore daylight saving.
    if (/^[+-]/.test(timeZone)) return false;
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function localTime(time: number, timeZone: string) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(
    formatter.formatToParts(time).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export type AvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

/** The full consultation must fit within a published weekly range. */
export function isAvailableTime(
  scheduledAt: Date,
  windows: AvailabilityWindow[],
  now: Date,
  timeZone: string,
  durationMinutes = SESSION_MINUTES,
) {
  const time = scheduledAt.getTime();
  if (
    ![30, 60, 120].includes(durationMinutes) ||
    !Number.isFinite(time) ||
    time % MINUTE !== 0 ||
    time < now.getTime() + NOTICE_MINUTES * MINUTE ||
    time > now.getTime() + BOOKING_WINDOW_DAYS * DAY
  )
    return false;
  const local = localTime(time, timeZone);
  if (local.minute % SESSION_MINUTES !== 0) return false;
  return windows.some((window) => {
    if (window.dayOfWeek !== local.dayOfWeek) return false;
    // Check each half-hour's endpoints on the actual timeline. This handles skipped
    // and repeated hours without assuming every local day has a fixed UTC offset.
    for (let elapsed = 0; elapsed < durationMinutes; elapsed += SESSION_MINUTES) {
      for (const offset of [elapsed * MINUTE, (elapsed + SESSION_MINUTES) * MINUTE - 1]) {
        const point = localTime(time + offset, timeZone);
        if (
          point.date !== local.date ||
          point.minute < window.startMinute ||
          point.minute >= window.endMinute
        )
          return false;
      }
    }
    return true;
  });
}

export function generateAvailableSlots(
  windows: AvailabilityWindow[],
  occupied: { scheduledAt: Date; durationMinutes: number }[],
  now: Date,
  timeZone: string,
  durationMinutes = SESSION_MINUTES,
): string[] {
  if (windows.length === 0) return [];
  // Fifteen-minute UTC steps also cover zones such as Kathmandu (UTC+5:45).
  // isAvailableTime enforces half-hour starts in the teacher's local time.
  const step = 15 * MINUTE;
  const blocked = new Set<number>();
  for (const booking of occupied) {
    const start = booking.scheduledAt.getTime();
    const end = start + booking.durationMinutes * MINUTE;
    for (
      let time = Math.floor((start - durationMinutes * MINUTE) / step) * step + step;
      time < end;
      time += step
    )
      blocked.add(time);
  }
  const slots: string[] = [];
  const first = Math.ceil((now.getTime() + NOTICE_MINUTES * MINUTE) / step) * step;
  const end = now.getTime() + BOOKING_WINDOW_DAYS * DAY;
  for (let time = first; time <= end; time += step) {
    const date = new Date(time);
    if (!blocked.has(time) && isAvailableTime(date, windows, now, timeZone, durationMinutes))
      slots.push(date.toISOString());
  }
  return slots;
}
