"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CopyIcon, PlusIcon, XIcon } from "lucide-react";
import { Alert, AlertDescription } from "@lms/ui/alert";
import { Button } from "@lms/ui/button";
import {
  Card,
  CardFooter,
  CardFrame,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@lms/ui/card";
import { Field, FieldLabel } from "@lms/ui/field";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@lms/ui/menu";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@lms/ui/select";
import { Skeleton } from "@lms/ui/skeleton";
import { Switch } from "@lms/ui/switch";
import { toastManager } from "@lms/ui/toast";
import type { AvailabilityWindow } from "@lms/api/consultation-scheduling";
import { nextAvailabilityRange } from "#lib/availability-editor.ts";
import { orpc } from "#lib/orpc.ts";

const days = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];
const maximumRanges = 28;
const timeItems = Array.from({ length: 49 }, (_, index) => {
  const hour = Math.floor(index / 2) % 24;
  return {
    value: index * 30,
    label: `${hour % 12 || 12}:${index % 2 ? "30" : "00"}${hour < 12 ? "am" : "pm"}`,
  };
});
const startTimeItems = timeItems.slice(0, -1);
const endTimeItems = timeItems.slice(1);

type DraftWindow = AvailabilityWindow & { key: string };

export function TeacherAvailability() {
  const query = useQuery(orpc.consultation.availability.get.queryOptions());
  return (
    <CardFrame render={<section aria-labelledby="availability-title" />}>
      <CardFrameHeader className="gap-y-1 py-5">
        <CardFrameTitle id="availability-title" render={<h2 />}>
          Weekly hours
        </CardFrameTitle>
        <CardFrameDescription>Set the times you are available each day.</CardFrameDescription>
      </CardFrameHeader>
      {query.isPending ? (
        <Card>
          <CardPanel>
            <Skeleton className="h-80 w-full" aria-label="Loading availability" />
          </CardPanel>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardPanel>
            <Alert variant="error">
              <AlertDescription>
                Couldn’t load your availability.{" "}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void query.refetch()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </CardPanel>
        </Card>
      ) : (
        <AvailabilityForm initialWindows={query.data.windows} />
      )}
    </CardFrame>
  );
}

function AvailabilityForm({ initialWindows }: { initialWindows: AvailabilityWindow[] }) {
  const [windows, setWindows] = useState<DraftWindow[]>(() =>
    initialWindows.map((window, index) => ({ ...window, key: `initial-${index}` })),
  );
  const [pausedWindows, setPausedWindows] = useState<Partial<Record<number, DraftWindow[]>>>({});
  const [error, setError] = useState("");
  const save = useMutation(orpc.consultation.availability.save.mutationOptions());

  function change(next: DraftWindow[]) {
    if (next.length > maximumRanges) {
      setError("You can add up to 28 time ranges across the week.");
      return;
    }
    setWindows(next);
    setError("");
  }

  function toggleDay(dayOfWeek: number, enabled: boolean) {
    const ranges = windows.filter((window) => window.dayOfWeek === dayOfWeek);
    if (!enabled) {
      setPausedWindows((previous) => ({ ...previous, [dayOfWeek]: ranges }));
      change(windows.filter((window) => window.dayOfWeek !== dayOfWeek));
      return;
    }
    const restored = pausedWindows[dayOfWeek] ?? [
      { key: crypto.randomUUID(), dayOfWeek, startMinute: 540, endMinute: 1020 },
    ];
    change([...windows, ...restored]);
  }

  function copyHours(dayOfWeek: number, targets: number[]) {
    const source = windows.filter((window) => window.dayOfWeek === dayOfWeek);
    change([
      ...windows.filter((window) => !targets.includes(window.dayOfWeek)),
      ...targets.flatMap((target) =>
        source.map((window) => ({
          ...window,
          key: crypto.randomUUID(),
          dayOfWeek: target,
        })),
      ),
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    setError("");
    for (const [index, window] of windows.entries()) {
      if (window.startMinute >= window.endMinute) {
        setError("Each end time must be later than its start time.");
        return;
      }
      if (
        windows
          .slice(0, index)
          .some(
            (other) =>
              other.dayOfWeek === window.dayOfWeek &&
              other.startMinute < window.endMinute &&
              window.startMinute < other.endMinute,
          )
      ) {
        setError("Time ranges on the same day must not overlap.");
        return;
      }
    }
    try {
      await save.mutateAsync({
        windows: windows.map(({ dayOfWeek, startMinute, endMinute }) => ({
          dayOfWeek,
          startMinute,
          endMinute,
        })),
      });
      toastManager.add({
        id: "availability-saved",
        type: "success",
        title: "Availability saved.",
        description: "Students can now book within your published hours.",
      });
    } catch {
      setError("Couldn’t save your availability. Please try again.");
    }
  }

  return (
    <Card render={<form onSubmit={(event) => void submit(event)} />}>
      <CardPanel className="p-0">
        <fieldset disabled={save.isPending} className="min-w-0">
          <legend className="sr-only">Weekly consultation hours in Perth time</legend>
          {days.map((day) => {
            const ranges = windows
              .filter((window) => window.dayOfWeek === day.value)
              .sort((a, b) => a.startMinute - b.startMinute);
            const nextRange = nextAvailabilityRange(ranges);
            const otherDays = days.filter((target) => target.value !== day.value);
            const canCopy = (targets: number[]) =>
              windows.filter((window) => !targets.includes(window.dayOfWeek)).length +
                ranges.length * targets.length <=
              maximumRanges;
            return (
              <div
                key={day.value}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 border-b px-5 py-4 last:border-b-0 sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)_auto]"
              >
                <Field className="min-h-8 flex-row items-center gap-3 self-start sm:min-h-7">
                  <Switch
                    checked={ranges.length > 0}
                    disabled={
                      save.isPending ||
                      (ranges.length === 0 &&
                        windows.length + (pausedWindows[day.value]?.length ?? 1) > maximumRanges)
                    }
                    onCheckedChange={(checked) => toggleDay(day.value, checked)}
                  />
                  <FieldLabel>{day.label}</FieldLabel>
                </Field>
                <div className="col-span-2 row-start-2 flex min-w-0 flex-col gap-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                  {ranges.length === 0 ? (
                    <p className="flex min-h-8 items-center text-sm text-muted-foreground sm:min-h-7">
                      Unavailable
                    </p>
                  ) : (
                    ranges.map((window, index) => (
                      <div key={window.key} className="flex min-w-0 items-center gap-2 sm:w-fit">
                        <TimeRangeSelect
                          label={`${day.label} start time, range ${index + 1}`}
                          items={startTimeItems}
                          value={window.startMinute}
                          disabled={save.isPending}
                          onValueChange={(startMinute) =>
                            change(
                              windows.map((item) =>
                                item.key === window.key ? { ...item, startMinute } : item,
                              ),
                            )
                          }
                        />
                        <span aria-hidden="true" className="text-muted-foreground">
                          –
                        </span>
                        <TimeRangeSelect
                          label={`${day.label} end time, range ${index + 1}`}
                          items={endTimeItems}
                          value={window.endMinute}
                          disabled={save.isPending}
                          onValueChange={(endMinute) =>
                            change(
                              windows.map((item) =>
                                item.key === window.key ? { ...item, endMinute } : item,
                              ),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${day.label} range ${index + 1}`}
                          title="Remove time range"
                          onClick={() => change(windows.filter((item) => item.key !== window.key))}
                        >
                          <XIcon aria-hidden="true" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="col-start-2 row-start-1 flex items-start gap-2 lg:col-start-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Add hours on ${day.label}`}
                    title="Add time range"
                    disabled={windows.length >= maximumRanges || nextRange === null}
                    onClick={() => {
                      if (nextRange)
                        change([
                          ...windows,
                          { ...nextRange, key: crypto.randomUUID(), dayOfWeek: day.value },
                        ]);
                    }}
                  >
                    <PlusIcon aria-hidden="true" />
                  </Button>
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          disabled={save.isPending || ranges.length === 0}
                          aria-label={`Copy ${day.label} hours to other days`}
                          title="Copy hours to other days"
                        />
                      }
                    >
                      <CopyIcon aria-hidden="true" />
                    </MenuTrigger>
                    <MenuPopup align="end">
                      <MenuGroup>
                        <MenuGroupLabel>Copy hours to</MenuGroupLabel>
                        {otherDays.map((target) => (
                          <MenuItem
                            key={target.value}
                            disabled={!canCopy([target.value])}
                            onClick={() => copyHours(day.value, [target.value])}
                          >
                            {target.label}
                          </MenuItem>
                        ))}
                      </MenuGroup>
                      <MenuSeparator />
                      <MenuGroup>
                        <MenuItem
                          disabled={!canCopy(otherDays.map((target) => target.value))}
                          onClick={() =>
                            copyHours(
                              day.value,
                              otherDays.map((target) => target.value),
                            )
                          }
                        >
                          All other days
                        </MenuItem>
                      </MenuGroup>
                    </MenuPopup>
                  </Menu>
                </div>
              </div>
            );
          })}
        </fieldset>
      </CardPanel>
      <CardFooter className="flex-col items-stretch gap-4 border-t">
        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" loading={save.isPending} className="self-start sm:shrink-0">
            Save availability
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function TimeRangeSelect({
  label,
  items,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  items: typeof timeItems;
  value: number;
  disabled: boolean;
  onValueChange: (value: number) => void;
}) {
  return (
    <Field className="w-28 min-w-0 flex-1 sm:flex-none">
      <FieldLabel className="sr-only">{label}</FieldLabel>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next);
        }}
      >
        <SelectTrigger
          size="sm"
          className="min-w-0 tabular-nums"
          title={value === 1440 ? "Midnight (end of day)" : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
                {item.value === 1440 ? " (end of day)" : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
    </Field>
  );
}
