"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import FullCalendar, {
  useCalendarController,
  type DatesSetInfo,
  type EventClickInfo,
  type EventDisplayInfo,
} from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import themePlugin from "@fullcalendar/react/themes/classic";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Alert, AlertDescription } from "@lms/ui/alert";
import { Button } from "@lms/ui/button";
import { Sheet, SheetPopup } from "@lms/ui/sheet";
import { Skeleton } from "@lms/ui/skeleton";
import { orpc } from "#lib/orpc.ts";
import { useLocalTimezone } from "#lib/use-local-timezone.ts";
import type { Consultation } from "#components/consultation-scheduler.tsx";

import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";

const plugins = [themePlugin, timeGridPlugin];
const dayHeaderFormat = { weekday: "short", day: "numeric" } as const;
const timeFormat = { hour: "numeric", minute: "2-digit", hour12: true } as const;
const slotFormat = { hour: "numeric", hour12: true } as const;
const noConsultations: Consultation[] = [];

type ConsultationCalendarProps = {
  student: boolean;
  renderDetails: (item: Consultation, close: () => void) => ReactNode;
};

export function ConsultationCalendar(props: ConsultationCalendarProps) {
  const timeZone = useLocalTimezone();
  return timeZone ? (
    <WeeklyCalendar {...props} />
  ) : (
    <Skeleton className="h-[720px] w-full rounded-xl" aria-label="Loading booking calendar" />
  );
}

function WeeklyCalendar({ student, renderDetails }: ConsultationCalendarProps) {
  const controller = useCalendarController();
  const [range, setRange] = useState<{ start: string; end: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedElement = useRef<HTMLElement | null>(null);
  const [restoreFocus, setRestoreFocus] = useState(true);
  const input = { range };
  const query = useQuery(orpc.consultation.list.queryOptions({ input, enabled: !!range }));
  const items = query.data?.items ?? noConsultations;
  const selected = items.find((item) => item.id === selectedId);
  const events = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        title: student
          ? item.teacherName || item.teacherEmail || "No teacher assigned"
          : `${item.firstName} ${item.lastName}`.trim(),
        start: item.scheduledAt.toISOString(),
        end: new Date(item.scheduledAt.getTime() + item.durationMinutes * 60_000).toISOString(),
        extendedProps: { status: item.status, reason: item.reason },
        className: `consultation-event consultation-event-${item.status}`,
      })),
    [items, student],
  );
  const datesSet = useCallback((info: DatesSetInfo) => {
    const start = info.start.toISOString();
    const end = info.end.toISOString();
    setRange((previous) =>
      previous?.start === start && previous.end === end ? previous : { start, end },
    );
  }, []);
  const eventClick = useCallback((info: EventClickInfo) => {
    selectedElement.current = info.el;
    setRestoreFocus(true);
    setSelectedId(info.event.id);
  }, []);

  return (
    <Sheet
      open={!!selected}
      onOpenChange={(open) => {
        if (!open) setSelectedId(null);
      }}
    >
      <div className="consultation-calendar isolate overflow-hidden rounded-xl border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous week"
                onClick={() => controller.prev()}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next week"
                onClick={() => controller.next()}
              >
                <ChevronRightIcon />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => controller.today()}>
              Today
            </Button>
            <h3 className="px-2 text-sm font-medium tabular-nums" aria-live="polite">
              {controller.view?.title ?? "This week"}
            </h3>
          </div>
        </div>
        {query.isError && (
          <Alert variant="error" className="m-3 w-auto">
            <AlertDescription>
              Couldn’t load bookings for this week.
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div className="overflow-x-auto" aria-busy={query.isFetching}>
          <div className="min-w-[760px]">
            <FullCalendar
              controller={controller}
              plugins={plugins}
              initialView="timeGridWeek"
              headerToolbar={false}
              firstDay={0}
              locale="en-au"
              timeZone="local"
              height={680}
              allDaySlot={false}
              slotDuration="00:30:00"
              slotHeaderInterval="01:00:00"
              slotHeaderFormat={slotFormat}
              slotMinHeight={28}
              scrollTime="08:00:00"
              dayHeaderFormat={dayHeaderFormat}
              dayHeaderClass="py-3 text-sm font-normal text-muted-foreground"
              nowIndicator
              editable={false}
              selectable={false}
              eventInteractive
              slotEventOverlap={false}
              eventMinHeight={24}
              eventTimeFormat={timeFormat}
              events={events}
              datesSet={datesSet}
              eventClick={eventClick}
              eventContent={renderEvent}
            />
          </div>
        </div>
      </div>
      <SheetPopup
        variant="inset"
        className="sm:max-w-lg"
        closeProps={{ className: "absolute end-5 top-5" }}
        finalFocus={() =>
          restoreFocus && selectedElement.current?.isConnected ? selectedElement.current : false
        }
      >
        {selected &&
          renderDetails(selected, () => {
            // Rescheduling transfers focus to the existing booking form/dialog.
            setRestoreFocus(false);
            setSelectedId(null);
          })}
      </SheetPopup>
    </Sheet>
  );
}

function renderEvent(info: EventDisplayInfo) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden px-1 py-0.5 text-xs leading-snug">
      <span className="truncate font-medium">{info.event.title}</span>
      <span className="truncate">{info.timeText}</span>
      <span className="truncate opacity-80">{info.event.extendedProps.reason}</span>
    </div>
  );
}
