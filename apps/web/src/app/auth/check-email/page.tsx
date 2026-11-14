import Link from "next/link";
import { headers } from "next/headers";
import { PageLayout } from "#components/page-layout.tsx";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : null;
  const host = (await headers()).get("host") ?? "";
  const isLocalDevelopment =
    process.env.NODE_ENV === "development" &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);

  return (
    <PageLayout
      variant="auth"
      title="Verify your email"
      description="Link sent to this address"
      actions={
        <Link href="/login" className="text-muted-foreground text-sm leading-4.5 hover:underline">
          Login
        </Link>
      }
    >
      {email && (
        <p className="truncate rounded-lg bg-muted px-3 py-2.5 text-sm font-medium" title={email}>
          {email}
        </p>
      )}
      {isLocalDevelopment && (
        <a
          className="text-xs text-muted-foreground hover:underline"
          href="http://127.0.0.1:55324"
          target="_blank"
          rel="noreferrer"
        >
          Open inbox (dev only)
        </a>
      )}
    </PageLayout>
  );
}
