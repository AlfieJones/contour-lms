import assert from "node:assert/strict";
import { test } from "node:test";
import {
  availableSlots as displayedSlots,
  calendarDate,
  firstAvailableDate as firstPublishedDate,
} from "./consultation-scheduling.ts";

const perth = "Australia/Perth";
const beforeFriday = new Date("2026-11-12T00:00:00Z");

void test("timezone date conversion preserves the instant around midnight", () => {
  const instant = new Date("2026-11-13T01:00:00Z");
  assert.equal(calendarDate(instant, perth).getDate(), 13);
  assert.equal(calendarDate(instant, "America/Los_Angeles").getDate(), 12);
  assert.equal(instant.toISOString(), "2026-11-13T01:00:00.000Z");
});

void test("the browser never offers unpublished times or invents default hours", () => {
  const day = new Date(2026, 10, 13);
  assert.deepEqual(displayedSlots(day, perth, beforeFriday, []), []);
  assert.deepEqual(
    displayedSlots(day, perth, beforeFriday, ["2026-11-13T06:00:00.000Z"]).map((slot) =>
      slot.toISOString(),
    ),
    ["2026-11-13T06:00:00.000Z"],
  );
  assert.equal(
    firstPublishedDate(beforeFriday, perth, ["2026-12-01T06:00:00.000Z"]).getMonth(),
    11,
  );
});
