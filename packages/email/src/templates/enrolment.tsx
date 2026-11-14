import { EmailLayout } from "../components/email-layout.tsx";
import { EmailText } from "../components/email-text.tsx";
import { EmailAction } from "../components/email-action.tsx";

export interface EnrolmentEmailProps {
  email: string;
  teacherName: string | null;
  hasAccount: boolean;
  appUrl: string;
}

export function EnrolmentEmail({ email, teacherName, hasAccount, appUrl }: EnrolmentEmailProps) {
  const teacher = teacherName?.trim() || "Your teacher";
  const href = new URL(hasAccount ? "/login" : "/signup", appUrl);
  href.searchParams.set("email", email);

  return (
    <EmailLayout title="You've been enrolled">
      <EmailText>
        {hasAccount
          ? `${teacher} added you as a student. Log in to book a consultation.`
          : `${teacher} added you as a student. Sign up with ${email} to book a consultation.`}
      </EmailText>
      <EmailAction href={href.toString()}>{hasAccount ? "Log in" : "Create account"}</EmailAction>
    </EmailLayout>
  );
}
