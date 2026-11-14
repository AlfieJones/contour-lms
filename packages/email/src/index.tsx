import type { ReactElement } from "react";
import { render, toPlainText } from "react-email";
import { EnrolmentEmail, type EnrolmentEmailProps } from "./templates/enrolment.tsx";
import { ConsultationEmail } from "./templates/consultation.tsx";
import { ConfirmationEmail } from "./templates/confirmation.tsx";
import { InviteEmail } from "./templates/invite.tsx";
import { RecoveryEmail } from "./templates/recovery.tsx";
import { MagicLinkEmail } from "./templates/magic-link.tsx";
import { EmailChangeEmail } from "./templates/email-change.tsx";
import { ReauthenticationEmail } from "./templates/reauthentication.tsx";
import { consultationEmailTitle, type ConsultationCalendarEmailProps } from "./calendar.ts";

export { EnrolmentEmail, type EnrolmentEmailProps } from "./templates/enrolment.tsx";
export { ConsultationEmail } from "./templates/consultation.tsx";
export { consultationCalendar, type ConsultationCalendarEmailProps } from "./calendar.ts";

// Supabase Auth fills these templates' placeholders when sending.
export const authEmails = {
  confirmation: { subject: "Verify your email · Contour", element: <ConfirmationEmail /> },
  invite: { subject: "Join Contour", element: <InviteEmail /> },
  recovery: { subject: "Reset your password · Contour", element: <RecoveryEmail /> },
  magic_link: { subject: "Your login link · Contour", element: <MagicLinkEmail /> },
  email_change: { subject: "Confirm your email · Contour", element: <EmailChangeEmail /> },
  reauthentication: { subject: "Verify it's you · Contour", element: <ReauthenticationEmail /> },
};

export async function renderEmail(element: ReactElement) {
  const html = await render(element);
  return { html, text: toPlainText(html) };
}

export async function renderEnrolmentEmail(input: EnrolmentEmailProps) {
  return {
    subject: "You've been enrolled · Contour",
    ...(await renderEmail(<EnrolmentEmail {...input} />)),
  };
}

export async function renderConsultationEmail(input: ConsultationCalendarEmailProps) {
  return {
    subject: `${consultationEmailTitle(input.kind)} · Contour`,
    ...(await renderEmail(<ConsultationEmail {...input} />)),
  };
}
