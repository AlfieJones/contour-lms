import nodemailer from "nodemailer";
import { renderEnrolmentEmail } from "./render.tsx";
import type { EnrolmentEmailProps } from "./templates/enrolment.tsx";

export interface EmailSenderConfig {
  smtpUrl: string;
  from: { name: string; address: string };
}

// Supabase's local SMTP server and hosted SMTP services use the same transport.
export function createEmailSender(config: EmailSenderConfig) {
  const transport = nodemailer.createTransport(
    {
      url: config.smtpUrl,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
    },
    { from: config.from },
  );

  return {
    async sendEnrolmentEmail(input: EnrolmentEmailProps) {
      const { subject, html, text } = await renderEnrolmentEmail(input);
      const result = await transport.sendMail({
        to: { address: input.email, name: "" },
        subject,
        html,
        text,
      });
      if (!result.accepted?.length || result.rejected?.length) {
        throw new Error("The mail server did not accept the email.");
      }
      return { messageId: result.messageId };
    },
  };
}
