import type { AvailabilityWindow } from "@lms/api/consultation-scheduling";

export function nextAvailabilityRange(ranges: AvailabilityWindow[]) {
  if (ranges.length === 0) return { startMinute: 540, endMinute: 1020 };

  const sorted = ranges.toSorted((a, b) => a.startMinute - b.startMinute);
  const lastEnd = Math.max(...sorted.map((range) => range.endMinute));
  if (lastEnd < 1440) {
    return { startMinute: lastEnd, endMinute: Math.min(lastEnd + 60, 1440) };
  }

  let startMinute = 0;
  for (const range of sorted) {
    if (range.startMinute - startMinute >= 30) {
      return { startMinute, endMinute: Math.min(startMinute + 60, range.startMinute) };
    }
    startMinute = Math.max(startMinute, range.endMinute);
  }
  return null;
}
