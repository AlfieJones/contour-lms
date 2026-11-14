import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableSlots,
  bookingWindow,
  calendarDate,
  calendarEvent,
  firstAvailableDate,
  formatBookingTime,
} from "../src/lib/consultation-scheduling.ts";

const perth = "Australia/Perth";
const beforeFriday = new Date("2026-11-12T00:00:00Z");

void test("weekday availability has 16 half-hour sessions within Perth business hours", () => {
  const slots = availableSlots(new Date(2026, 10, 13), perth, beforeFriday);
  assert.equal(slots.length, 16);
  assert.equal(slots[0]?.toISOString(), "2026-11-13T01:00:00.000Z");
  assert.equal(slots.at(-1)?.toISOString(), "2026-11-13T08:30:00.000Z");
  for (let index = 1; index < slots.length; index++) {
    assert.equal(slots[index]!.getTime() - slots[index - 1]!.getTime(), 30 * 60_000);
  }
});

void test("weekends have no slots and the first available date skips the weekend", () => {
  assert.deepEqual(availableSlots(new Date(2026, 10, 14), perth, beforeFriday), []);
  const next = firstAvailableDate(new Date("2026-11-13T08:00:00Z"), perth);
  assert.deepEqual([next.getFullYear(), next.getMonth(), next.getDate()], [2026, 10, 16]);
});

void test("one hour notice excludes earlier slots, including a slot that just expired", () => {
  const now = new Date("2026-11-13T02:00:00Z");
  const slots = availableSlots(new Date(2026, 10, 13), perth, now);
  assert.equal(slots[0]?.toISOString(), "2026-11-13T03:00:00.000Z");
  const later = availableSlots(new Date(2026, 10, 13), perth, new Date(now.getTime() + 1));
  assert.equal(later[0]?.toISOString(), "2026-11-13T03:30:00.000Z");
});

void test("past dates and dates beyond the 90-day local booking window are excluded", () => {
  assert.deepEqual(availableSlots(new Date(2026, 10, 11), perth, beforeFriday), []);
  const { end } = bookingWindow(beforeFriday, perth);
  assert.ok(availableSlots(end, perth, beforeFriday).length > 0);
  end.setDate(end.getDate() + 1);
  assert.deepEqual(availableSlots(end, perth, beforeFriday), []);
});

void test("each returned slot belongs to the selected date in an American timezone", () => {
  const zone = "America/Los_Angeles";
  const day = new Date(2026, 10, 12);
  const slots = availableSlots(day, zone, new Date("2026-11-11T00:00:00Z"));
  assert.equal(slots.length, 16);
  for (const slot of slots) {
    const local = calendarDate(slot, zone);
    assert.deepEqual([local.getMonth(), local.getDate()], [10, 12]);
  }
  assert.ok(slots.some((slot) => slot.toISOString().startsWith("2026-11-13")));
});

void test("UTC+14 dates can include Perth availability from the previous UTC day", () => {
  const zone = "Pacific/Kiritimati";
  const slots = availableSlots(new Date(2026, 10, 13), zone, beforeFriday);
  assert.equal(slots.length, 16);
  for (const slot of slots) assert.equal(calendarDate(slot, zone).getDate(), 13);
});

void test("display timezone follows daylight saving while Perth hours stay fixed", () => {
  const before = availableSlots(new Date(2026, 2, 6), perth, new Date("2026-03-01T00:00:00Z"))[0]!;
  const after = availableSlots(new Date(2026, 2, 9), perth, new Date("2026-03-01T00:00:00Z"))[0]!;
  assert.equal(formatBookingTime(before, "America/New_York", false), "20:00");
  assert.equal(formatBookingTime(after, "America/New_York", false), "21:00");
  assert.equal(formatBookingTime(before, perth, false), "09:00");
  assert.equal(formatBookingTime(after, perth, false), "09:00");
});

void test("timezone date conversion preserves the instant around midnight", () => {
  const instant = new Date("2026-11-13T01:00:00Z");
  assert.equal(calendarDate(instant, perth).getDate(), 13);
  assert.equal(calendarDate(instant, "America/Los_Angeles").getDate(), 12);
  assert.equal(instant.toISOString(), "2026-11-13T01:00:00.000Z");
});

void test("calendar export uses UTC instants and ends 30 minutes after the start", () => {
  const event = calendarEvent("booking-id", new Date("2026-11-13T01:00:00Z"));
  assert.ok(event.includes("DTSTART:20261113T010000Z\r\n"));
  assert.ok(event.includes("DTEND:20261113T013000Z\r\n"));
  assert.ok(event.includes("UID:booking-id@contour\r\n"));
  assert.ok(event.endsWith("END:VCALENDAR\r\n"));
});
