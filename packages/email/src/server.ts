import { createEnv } from "@lms/env/server";
import nodemailer, { type SendMailOptions } from "nodemailer";
import { z } from "zod";
import { renderEnrolmentEmail, renderConsultationEmail } from "./index.tsx";
import type { EnrolmentEmailProps } from "./templates/enrolment.tsx";
import { consultationCalendar, type ConsultationCalendarEmailProps } from "./calendar.ts";

const env = createEnv({
  scope: "email",
  schema: {
    APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
    EMAIL_SMTP_URL: z.url({ protocol: /^smtps?$/ }).default("smtp://127.0.0.1:55325"),
    EMAIL_FROM: z.email().default("noreply@contour.local"),
    EMAIL_FROM_NAME: z.string().trim().min(1).default("Contour"),
  },
});

const from = { name: env.EMAIL_FROM_NAME, address: env.EMAIL_FROM };
// Local development delivers into Supabase's Mailpit inbox.
const transport = nodemailer.createTransport(
  {
    url: env.EMAIL_SMTP_URL,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  },
  { from },
);

async function sendEmail(message: SendMailOptions) {
  const result = await transport.sendMail(message);
  if (!result.accepted?.length || result.rejected?.length) {
    throw new Error("The mail server did not accept the email.");
  }
  return { messageId: result.messageId };
}

export async function sendEnrolmentEmail(input: Omit<EnrolmentEmailProps, "appUrl">) {
  return sendEmail({
    to: { address: input.email, name: "" },
    ...(await renderEnrolmentEmail({ ...input, appUrl: env.APP_URL })),
  });
}

export async function sendConsultationEmail(input: Omit<ConsultationCalendarEmailProps, "appUrl">) {
  const props = { ...input, appUrl: env.APP_URL };
  return sendEmail({
    to: { address: input.recipient, name: "" },
    ...(await renderConsultationEmail(props)),
    icalEvent: { filename: "consultation.ics", ...consultationCalendar(props, from) },
  });
}
