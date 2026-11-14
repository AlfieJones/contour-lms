export interface ConsultationCalendarEmailProps {
  consultationId: string;
  sequence: number;
  kind: "booked" | "rescheduled" | "cancelled";
  scheduledAt: string;
  updatedAt: string;
  durationMinutes: number;
  studentName: string;
  teacherName: string;
  studentEmail: string | null;
  teacherEmail: string | null;
  recipient: string;
  appUrl: string;
}

export function consultationEmailTitle(kind: ConsultationCalendarEmailProps["kind"]) {
  return kind === "cancelled"
    ? "Consultation cancelled"
    : kind === "rescheduled"
      ? "Consultation rescheduled"
      : "Consultation booked";
}

const text = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

// RFC 5545 content lines are limited to 75 octets, including continuation whitespace.
function fold(line: string) {
  let result = "";
  let bytes = 0;
  for (const character of line) {
    const length = Buffer.byteLength(character);
    if (bytes + length > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += length;
  }
  return result;
}

function stamp(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function consultationCalendar(
  input: ConsultationCalendarEmailProps,
  organizer: { name: string; address: string },
) {
  const method = input.kind === "cancelled" ? "CANCEL" : "REQUEST";
  const url = new URL("/", input.appUrl).toString();
  const attendees = [
    ...new Set([input.studentEmail, input.teacherEmail].filter((email) => email !== null)),
  ];
  // Addresses are persisted from verified accounts/enrolments, never interpolated as content lines.
  for (const email of [...attendees, organizer.address]) {
    if (/[\r\n]/.test(email) || !email.includes("@"))
      throw new Error("Invalid calendar email address.");
  }
  const organizerName = organizer.name
    .replace(/\^/g, "^^")
    .replace(/\r\n|\r|\n/g, "^n")
    .replace(/"/g, "^'");
  const description = `Student: ${input.studentName}\nTeacher: ${input.teacherName}\nView your consultation in Contour: ${url}\nMake booking changes in Contour. Calendar replies do not change your booking.`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Contour//Consultations//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${input.consultationId}@contour`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${stamp(input.updatedAt)}`,
    `LAST-MODIFIED:${stamp(input.updatedAt)}`,
    `DTSTART:${stamp(input.scheduledAt)}`,
    `DTEND:${stamp(new Date(new Date(input.scheduledAt).getTime() + input.durationMinutes * 60_000).toISOString())}`,
    `ORGANIZER;CN="${organizerName}":mailto:${organizer.address}`,
    ...attendees.map(
      (email) =>
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`,
    ),
    "SUMMARY:Contour consultation",
    `DESCRIPTION:${text(description)}`,
    `URL:${url}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  return { method, content: lines.map(fold).join("\r\n") };
}
