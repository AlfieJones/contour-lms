import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";
import { EmailAction } from "../components/email-action.tsx";

export function InviteEmail({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: {
  confirmationUrl?: string;
}) {
  return (
    <EmailLayout title="Join Contour">
      <EmailText>Your account is ready to set up.</EmailText>
      <EmailAction href={confirmationUrl}>Accept invitation</EmailAction>
    </EmailLayout>
  );
}
