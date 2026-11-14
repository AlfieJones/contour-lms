import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";
import { EmailAction } from "../components/email-action.tsx";

export function RecoveryEmail({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: {
  confirmationUrl?: string;
}) {
  return (
    <EmailLayout title="Reset your password">
      <EmailText>Choose a new password for your account.</EmailText>
      <EmailAction href={confirmationUrl}>Reset password</EmailAction>
    </EmailLayout>
  );
}
