import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";
import { EmailAction } from "../components/email-action.tsx";

export function EmailChangeEmail({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: {
  confirmationUrl?: string;
}) {
  return (
    <EmailLayout title="Confirm your email">
      <EmailText>Confirm this address to update your account.</EmailText>
      <EmailAction href={confirmationUrl}>Confirm email</EmailAction>
    </EmailLayout>
  );
}
