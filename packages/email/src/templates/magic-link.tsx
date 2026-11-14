import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";
import { EmailAction } from "../components/email-action.tsx";

export function MagicLinkEmail({
  confirmationUrl = "{{ .ConfirmationURL }}",
}: {
  confirmationUrl?: string;
}) {
  return (
    <EmailLayout title="Your login link">
      <EmailText>Use this link to log in to Contour.</EmailText>
      <EmailAction href={confirmationUrl}>Log in</EmailAction>
    </EmailLayout>
  );
}
