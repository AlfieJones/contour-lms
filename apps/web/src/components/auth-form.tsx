"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@lms/ui/button";
import { PageLayout } from "#components/page-layout.tsx";
import { Field, FieldLabel } from "@lms/ui/field";
import { Input } from "@lms/ui/input";
import { getSupabaseBrowserClient } from "#lib/supabase.ts";

export function AuthForm({ signup = false, email = "" }: { signup?: boolean; email?: string }) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting: pending },
  } = useForm({
    defaultValues: { name: "", email, password: "" },
    shouldUseNativeValidation: true,
  });
  const [error, setError] = useState("");

  async function submit(values: { name: string; email: string; password: string }) {
    const email = values.email.trim();
    const password = values.password;
    const name = values.name.trim();
    setError("");
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
      <form onSubmit={handleSubmit(submit)} className="flex w-full flex-col gap-4">
        {signup && (
          <Field name="name">
            <FieldLabel htmlFor="auth-name">Name</FieldLabel>
            <Input
              nativeInput
              id="auth-name"
              {...register("name", {
                validate: (value) => !signup || !!value.trim() || "Enter your name.",
              })}
              type="text"
              autoComplete="name"
              required
              maxLength={100}
            />
          </Field>
        )}
        <Field name="email">
          <FieldLabel htmlFor="auth-email">Email</FieldLabel>
          <Input
            nativeInput
            id="auth-email"
            {...register("email", { required: "Enter your email." })}
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </Field>
        <Field name="password">
          <FieldLabel htmlFor="auth-password">Password</FieldLabel>
          <Input
            nativeInput
            id="auth-password"
            {...register("password", { required: "Enter your password." })}
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : undefined}
            maxLength={128}
          />
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
      </form>
    </PageLayout>
  );
}
