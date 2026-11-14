import { expect, test } from "vitest";
import {
  generateAvailableSlots,
  isAvailableTime,
  isValidTimeZone,
  type AvailabilityWindow,
} from "./consultation-scheduling.ts";

const perth = "Australia/Perth";
const melbourne = "Australia/Melbourne";
const now = new Date("2026-11-12T00:00:00Z");
const friday: AvailabilityWindow[] = [
  { dayOfWeek: 5, startMinute: 540, endMinute: 720 },
  { dayOfWeek: 5, startMinute: 780, endMinute: 1020 },
];
const at = (value: string) => new Date(`2026-11-13T${value}:00Z`);

test("the full consultation fits in one range and cannot cross a break or midnight", () => {
  expect(isAvailableTime(at("03:30"), friday, now, perth, 30)).toBe(true);
  expect(isAvailableTime(at("03:30"), friday, now, perth, 60)).toBe(false);
  expect(isAvailableTime(at("04:00"), friday, now, perth)).toBe(false);
  expect(isAvailableTime(at("07:00"), friday, now, perth, 120)).toBe(true);
  expect(isAvailableTime(at("07:30"), friday, now, perth, 120)).toBe(false);
  const late = [{ dayOfWeek: 5, startMinute: 1380, endMinute: 1440 }];
  expect(isAvailableTime(at("15:30"), late, now, perth, 30)).toBe(true);
  expect(isAvailableTime(at("15:30"), late, now, perth, 60)).toBe(false);
});

test("notice, booking horizon and exact half-hour alignment are enforced", () => {
  expect(isAvailableTime(at("01:00"), friday, new Date("2026-11-13T00:00:00Z"), perth)).toBe(true);
  expect(isAvailableTime(at("01:00"), friday, new Date("2026-11-13T00:00:00.001Z"), perth)).toBe(
    false,
  );
  expect(isAvailableTime(at("01:01"), friday, now, perth)).toBe(false);
  expect(isAvailableTime(at("01:00"), friday, new Date("2026-01-01T00:00:00Z"), perth)).toBe(false);
  expect(isAvailableTime(at("01:00"), friday, now, perth, 45)).toBe(false);
});

test("occupied consultations block all overlapping starts for each duration", () => {
  const occupied = [{ scheduledAt: at("02:00"), durationMinutes: 60 }];
  const halfHour = generateAvailableSlots(friday, occupied, now, perth, 30);
  expect(halfHour).toContain(at("01:30").toISOString());
  expect(halfHour).not.toContain(at("02:00").toISOString());
  expect(halfHour).not.toContain(at("02:30").toISOString());
  expect(halfHour).toContain(at("03:00").toISOString());
  const hour = generateAvailableSlots(friday, occupied, now, perth, 60);
  expect(hour).not.toContain(at("01:30").toISOString());
  expect(hour).toContain(at("01:00").toISOString());
  expect(hour).toContain(at("03:00").toISOString());
});

const weekdays = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startMinute: 540,
  endMinute: 1020,
}));

test.each([
  ["2026-07-06T23:00:00Z", "2026-07-06T22:30:00Z"], // 9am AEST (UTC+10)
  ["2026-11-12T22:00:00Z", "2026-11-12T21:30:00Z"], // 9am AEDT (UTC+11)
])("Melbourne weekly hours follow daylight saving: %s", (opening, before) => {
  const start = new Date(opening);
  const earlier = new Date(start.getTime() - 86400_000);
  expect(isAvailableTime(start, weekdays, earlier, melbourne)).toBe(true);
  expect(isAvailableTime(new Date(before), weekdays, earlier, melbourne)).toBe(false);
  expect(isAvailableTime(start, weekdays, earlier, perth)).toBe(false);
  const slots = generateAvailableSlots(weekdays, [], earlier, melbourne);
  expect(slots).toContain(opening.replace("Z", ".000Z"));
  expect(slots).not.toContain(before.replace("Z", ".000Z"));
});

test("slot generation crosses Melbourne's spring DST change without shifting weekly hours", () => {
  const slots = generateAvailableSlots(weekdays, [], new Date("2026-10-01T00:00:00Z"), melbourne);
  expect(slots).toContain("2026-10-01T23:00:00.000Z"); // Friday 9am AEST
  expect(slots).toContain("2026-10-04T22:00:00.000Z"); // Monday 9am AEDT
  expect(slots).not.toContain("2026-10-04T21:30:00.000Z");
});

test("DST transitions check the entire elapsed session, including repeated hours", () => {
  const sunday = [{ dayOfWeek: 0, startMinute: 60, endMinute: 240 }];
  expect(
    isAvailableTime(
      new Date("2026-10-03T15:30:00Z"),
      sunday,
      new Date("2026-10-02T00:00:00Z"),
      melbourne,
      60,
    ),
  ).toBe(true); // 1:30 to 3:30
  expect(
    isAvailableTime(
      new Date("2026-10-03T15:30:00Z"),
      sunday,
      new Date("2026-10-02T00:00:00Z"),
      melbourne,
      120,
    ),
  ).toBe(false); // ends 4:30
  const repeated = [{ dayOfWeek: 0, startMinute: 150, endMinute: 180 }];
  expect(
    isAvailableTime(
      new Date("2026-04-04T15:30:00Z"),
      repeated,
      new Date("2026-04-03T00:00:00Z"),
      melbourne,
      30,
    ),
  ).toBe(true);
  expect(
    isAvailableTime(
      new Date("2026-04-04T15:30:00Z"),
      repeated,
      new Date("2026-04-03T00:00:00Z"),
      melbourne,
      60,
    ),
  ).toBe(false);
  expect(
    isAvailableTime(
      new Date("2026-04-04T16:30:00Z"),
      repeated,
      new Date("2026-04-03T00:00:00Z"),
      melbourne,
      30,
    ),
  ).toBe(true);
});

test("half-hour alignment follows the teacher's zone, including quarter-hour offsets", () => {
  const zone = "Asia/Kathmandu";
  const earlier = new Date("2026-11-12T00:00:00Z");
  const slots = generateAvailableSlots(weekdays, [], earlier, zone);
  expect(slots).toContain("2026-11-13T03:15:00.000Z"); // 9am local
  expect(slots).not.toContain("2026-11-13T03:30:00.000Z"); // 9:15 local
});

test("timezone input accepts named zones and rejects invalid or fixed-offset values", () => {
  expect(isValidTimeZone(melbourne)).toBe(true);
  expect(isValidTimeZone("UTC")).toBe(true);
  expect(isValidTimeZone("Not/AZone")).toBe(false);
  expect(isValidTimeZone("+10:00")).toBe(false);
});
