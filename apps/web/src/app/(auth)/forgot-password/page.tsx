"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@lms/ui/button";
import { Field, FieldLabel } from "@lms/ui/field";
import { Form } from "@lms/ui/form";
import { Input } from "@lms/ui/input";
import { PageLayout } from "#components/page-layout.tsx";
import { FormError } from "#components/form-error.tsx";
import { getSupabaseBrowserClient } from "#lib/supabase.ts";
import { formText } from "#lib/form.ts";

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const email = formText(new FormData(event.currentTarget), "email").trim();
    setPending(true);
    setError("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings/security`,
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setError("Couldn’t send the reset email. Please try again shortly.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PageLayout
      variant="auth"
      title="Reset password"
      description="We’ll email you a link to get back into your account."
    >
      <Form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        {sent ? (
          <p role="status" className="text-sm">
            If an account exists for this email, you’ll receive a link to reset your password.
            Follow it to Account → Security and choose a new password.
          </p>
        ) : (
          <>
            <Field name="email" disabled={pending}>
              <FieldLabel>Email</FieldLabel>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                disabled={pending}
              />
            </Field>
            <Button type="submit" loading={pending}>
              Send reset link
            </Button>
          </>
        )}
        <FormError message={error} />
        <Link href="/login" className="text-sm text-muted-foreground hover:underline">
          Back to log in
        </Link>
      </Form>
    </PageLayout>
  );
}
