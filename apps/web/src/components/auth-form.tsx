"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@lms/ui/button";
import { PageLayout } from "#components/page-layout.tsx";
import { Field, FieldError, FieldLabel } from "@lms/ui/field";
import { Form } from "@lms/ui/form";
import { Input } from "@lms/ui/input";
import { getSupabaseBrowserClient } from "#lib/supabase.ts";
import { formText } from "#lib/form.ts";

export function AuthForm({ signup = false, email = "" }: { signup?: boolean; email?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = formText(form, "email").trim();
    const password = formText(form, "password");
    const name = formText(form, "name").trim();
    setError("");
    if (signup && !name) {
      setError("Enter your name.");
      return;
    }
    setPending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (signup) {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: name },
          },
        });
        if (result.error) throw result.error;
        window.location.assign(`/auth/check-email?email=${encodeURIComponent(email)}`);
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        // A full navigation starts with fresh server state and an empty query cache.
        window.location.assign("/");
      }
    } catch (cause) {
      setError(
        signup
          ? "Could not create your account. Check your details or try again shortly."
          : cause instanceof Error && cause.message.includes("Email not confirmed")
            ? "Confirm your email before logging in."
            : "Could not log in. Check your email and password or try again shortly.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <PageLayout
      variant="auth"
      title={signup ? "Create account" : "Log in"}
      actions={
        <Link
          className="text-muted-foreground text-sm leading-4.5 hover:underline"
          href={`${signup ? "/login" : "/signup"}${email ? `?email=${encodeURIComponent(email)}` : ""}`}
        >
          {signup ? "Log in" : "Sign up"}
        </Link>
      }
    >
      <Form onSubmit={submit} className="flex w-full flex-col gap-4">
        {signup && (
          <Field name="name">
            <FieldLabel>Name</FieldLabel>
            <Input name="name" type="text" autoComplete="name" required maxLength={100} />
            <FieldError />
          </Field>
        )}
        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input
            name="email"
            defaultValue={email}
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
          <FieldError />
        </Field>
        <Field name="password">
          <FieldLabel>Password</FieldLabel>
          <Input
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : undefined}
            maxLength={128}
          />
          <FieldError />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive-foreground">
            {error}
          </p>
        )}
        <Button className="w-full" type="submit" loading={pending}>
          {signup ? "Sign up" : "Log in"}
        </Button>
        {!signup && (
          <Link
            href="/forgot-password"
            className="text-center text-sm text-muted-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        )}
      </Form>
    </PageLayout>
  );
}
