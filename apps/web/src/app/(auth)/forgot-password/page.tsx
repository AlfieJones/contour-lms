"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@lms/ui/button";
import { Field, FieldLabel } from "@lms/ui/field";
import { Input } from "@lms/ui/input";
import { PageLayout } from "#components/page-layout.tsx";
import { FormError } from "#components/form-error.tsx";
import { getSupabaseBrowserClient } from "#lib/supabase.ts";

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting: pending },
  } = useForm({
    defaultValues: { email: "" },
    shouldUseNativeValidation: true,
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(values: { email: string }) {
    const email = values.email.trim();
    setError("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings/security`,
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setError("Couldn’t send the reset email. Please try again shortly.");
    }
  }
  return (
    <PageLayout
      variant="auth"
      title="Reset password"
      description="We’ll email you a link to get back into your account."
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
        {sent ? (
          <p role="status" className="text-sm">
            If an account exists for this email, you’ll receive a link to reset your password.
            Follow it to Account → Security and choose a new password.
          </p>
        ) : (
          <>
            <Field name="email" disabled={pending}>
              <FieldLabel htmlFor="reset-email">Email</FieldLabel>
              <Input
                nativeInput
                id="reset-email"
                {...register("email", { required: "Enter your email." })}
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
      </form>
    </PageLayout>
  );
}
