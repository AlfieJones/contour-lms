import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";
import { EmailAction } from "../components/email-action.tsx";

export function ConfirmationEmail({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: {
  confirmationUrl?: string;
}) {
  return (
    <EmailLayout title="Verify your email">
      <EmailText>Confirm your email to finish signing up.</EmailText>
      <EmailAction href={confirmationUrl}>Verify email</EmailAction>
    </EmailLayout>
  );
}
