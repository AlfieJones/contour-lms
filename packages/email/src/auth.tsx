import { ConfirmationEmail } from "./templates/confirmation.tsx";
import { InviteEmail } from "./templates/invite.tsx";
import { RecoveryEmail } from "./templates/recovery.tsx";
import { MagicLinkEmail } from "./templates/magic-link.tsx";
import { EmailChangeEmail } from "./templates/email-change.tsx";
import { ReauthenticationEmail } from "./templates/reauthentication.tsx";

// These placeholders are evaluated by Supabase Auth when it sends the email.
export const authEmails = {
  confirmation: { subject: "Verify your email · Contour", element: <ConfirmationEmail /> },
  invite: { subject: "Join Contour", element: <InviteEmail /> },
  recovery: { subject: "Reset your password · Contour", element: <RecoveryEmail /> },
  magic_link: { subject: "Your login link · Contour", element: <MagicLinkEmail /> },
  email_change: { subject: "Confirm your email · Contour", element: <EmailChangeEmail /> },
  reauthentication: { subject: "Verify it's you · Contour", element: <ReauthenticationEmail /> },
};
