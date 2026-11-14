import { PageLayout } from "#components/page-layout.tsx";
import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <PageLayout variant="auth" title="This confirmation link could not be used">
      <p>
        It may have expired, already been used, or been opened in a different browser. Try logging
        in if your email is already confirmed.
      </p>
      <Link href="/login" className="underline">
        Return to login
      </Link>
    </PageLayout>
  );
}
