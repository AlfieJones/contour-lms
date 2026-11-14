import { consultationEmailTitle, type ConsultationCalendarEmailProps } from "../calendar.ts";
import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";
import { EmailAction } from "../components/email-action.tsx";

export function ConsultationEmail(input: ConsultationCalendarEmailProps) {
  const when = new Intl.DateTimeFormat("en-AU", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  }).format(new Date(input.scheduledAt));
  return (
    <EmailLayout title={consultationEmailTitle(input.kind)}>
      <EmailText>
        {input.studentName} · {input.teacherName}
      </EmailText>
      <EmailText>
        {when} (Perth, UTC+8) · {input.durationMinutes} minutes
      </EmailText>
      <EmailText>
        {input.kind === "cancelled"
          ? "This consultation has been cancelled. The attached calendar notice can remove it from your calendar."
          : "Use the attached calendar invitation to add this consultation or update its time. Your calendar shows the time in your local timezone."}
      </EmailText>
      <EmailText>
        Your booking is saved in Contour. Make changes there; accepting or declining this invitation
        does not change your booking.
      </EmailText>
      <EmailAction href={new URL("/", input.appUrl).toString()}>View consultations</EmailAction>
    </EmailLayout>
  );
}
