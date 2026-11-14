export const SESSION_MINUTES = 30;
export const NOTICE_MINUTES = 60;
export const BOOKING_WINDOW_DAYS = 90;
export const AVAILABILITY_TIME_ZONE = "Australia/Perth";
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const PERTH_OFFSET = 8 * 60 * MINUTE;

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
  durationMinutes = SESSION_MINUTES,
) {
  const time = scheduledAt.getTime();
  if (
    ![30, 60, 120].includes(durationMinutes) ||
    !Number.isFinite(time) ||
    time % (SESSION_MINUTES * MINUTE) !== 0 ||
    time < now.getTime() + NOTICE_MINUTES * MINUTE ||
    time > now.getTime() + BOOKING_WINDOW_DAYS * DAY
  )
    return false;
  const local = new Date(time + PERTH_OFFSET);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  return windows.some(
    (window) =>
      window.dayOfWeek === local.getUTCDay() &&
      minute >= window.startMinute &&
      minute + durationMinutes <= window.endMinute,
  );
}

export function generateAvailableSlots(
  windows: AvailabilityWindow[],
  occupied: { scheduledAt: Date; durationMinutes: number }[],
  now: Date,
  durationMinutes = SESSION_MINUTES,
): string[] {
  if (windows.length === 0) return [];
  const duration = SESSION_MINUTES * MINUTE;
  // Include overlaps with legacy bookings that were not aligned to half hours.
  const blocked = new Set<number>();
  for (const booking of occupied) {
    const start = booking.scheduledAt.getTime();
    const end = start + booking.durationMinutes * MINUTE;
    for (
      let time = Math.floor((start - durationMinutes * MINUTE) / duration) * duration + duration;
      time < end;
      time += duration
    ) {
      blocked.add(time);
    }
  }
  const slots: string[] = [];
  const first = Math.ceil((now.getTime() + NOTICE_MINUTES * MINUTE) / duration) * duration;
  const end = now.getTime() + BOOKING_WINDOW_DAYS * DAY;
  for (let time = first; time <= end; time += duration) {
    const date = new Date(time);
    if (!blocked.has(time) && isAvailableTime(date, windows, now, durationMinutes))
      slots.push(date.toISOString());
  }
  return slots;
}
