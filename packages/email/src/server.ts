import { env } from "@lms/env/email";
import { createEmailSender } from "./sender.ts";
import type { EnrolmentEmailProps } from "./templates/enrolment.tsx";

if (typeof window !== "undefined") throw new Error("Email delivery is server-only.");

let sender: ReturnType<typeof createEmailSender> | undefined;

export function sendEnrolmentEmail(input: Omit<EnrolmentEmailProps, "appUrl">) {
  sender ??= createEmailSender({
    smtpUrl: env.EMAIL_SMTP_URL,
    from: { name: env.EMAIL_FROM_NAME, address: env.EMAIL_FROM },
  });
  return sender.sendEnrolmentEmail({ ...input, appUrl: env.APP_URL });
}
