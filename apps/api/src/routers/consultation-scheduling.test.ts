import { expect, test } from "vitest";
import {
  generateAvailableSlots,
  isAvailableTime,
  type AvailabilityWindow,
} from "./consultation-scheduling.ts";

const now = new Date("2026-11-12T00:00:00Z");
const friday: AvailabilityWindow[] = [
  { dayOfWeek: 5, startMinute: 540, endMinute: 720 },
  { dayOfWeek: 5, startMinute: 780, endMinute: 1020 },
];
const at = (value: string) => new Date(`2026-11-13T${value}:00Z`);

test("the full consultation fits in one range and cannot cross a break or midnight", () => {
  expect(isAvailableTime(at("03:30"), friday, now, 30)).toBe(true);
  expect(isAvailableTime(at("03:30"), friday, now, 60)).toBe(false);
  expect(isAvailableTime(at("04:00"), friday, now)).toBe(false);
  expect(isAvailableTime(at("07:00"), friday, now, 120)).toBe(true);
  expect(isAvailableTime(at("07:30"), friday, now, 120)).toBe(false);
  const late = [{ dayOfWeek: 5, startMinute: 1380, endMinute: 1440 }];
  expect(isAvailableTime(at("15:30"), late, now, 30)).toBe(true);
  expect(isAvailableTime(at("15:30"), late, now, 60)).toBe(false);
});

test("notice, booking horizon and exact half-hour alignment are enforced", () => {
  expect(isAvailableTime(at("01:00"), friday, new Date("2026-11-13T00:00:00Z"))).toBe(true);
  expect(isAvailableTime(at("01:00"), friday, new Date("2026-11-13T00:00:00.001Z"))).toBe(false);
  expect(isAvailableTime(at("01:01"), friday, now)).toBe(false);
  expect(isAvailableTime(at("01:00"), friday, new Date("2026-01-01T00:00:00Z"))).toBe(false);
  expect(isAvailableTime(at("01:00"), friday, now, 45)).toBe(false);
});

test("occupied consultations block all overlapping starts for each duration", () => {
  const occupied = [{ scheduledAt: at("02:00"), durationMinutes: 60 }];
  const halfHour = generateAvailableSlots(friday, occupied, now, 30);
  expect(halfHour).toContain(at("01:30").toISOString());
  expect(halfHour).not.toContain(at("02:00").toISOString());
  expect(halfHour).not.toContain(at("02:30").toISOString());
  expect(halfHour).toContain(at("03:00").toISOString());
  const hour = generateAvailableSlots(friday, occupied, now, 60);
  expect(hour).not.toContain(at("01:30").toISOString());
  expect(hour).toContain(at("01:00").toISOString());
  expect(hour).toContain(at("03:00").toISOString());
});
