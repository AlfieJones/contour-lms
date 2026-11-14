"use client";

import { Button } from "@lms/ui/button";
import { Field, FieldLabel } from "@lms/ui/field";
import { Input } from "@lms/ui/input";
import type { Session } from "@lms/api";
import { createApiClient } from "@lms/api/client";
import { useEffect, useState, type FormEvent } from "react";

import { createClient } from "#lib/supabase/client.ts";

const api = createApiClient();

export function AuthForm() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.session.get().then(
      (result) => {
        if (active) {
          setSession(result);
          setBusy(false);
        }
      },
      () => {
        if (active) {
          setError("Could not check your session. Please try again.");
          setBusy(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = fields.get("email");
    const password = fields.get("password");
    if (typeof email !== "string" || typeof password !== "string") return;
    const credentials = { email, password };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const result =
        mode === "sign-up"
          ? await supabase.auth.signUp({
              ...credentials,
              options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
            })
          : await supabase.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      setSession(await api.session.get());
      form.reset();
      if (!result.data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
      setSession(await api.session.get());
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">
        {session ? "Your account" : mode === "sign-up" ? "Create an account" : "Sign in"}
      </h1>
      {session ? (
        <>
          <p className="text-muted-foreground">
            Signed in as {session.user.email ?? "your account"}.
          </p>
          <Button
            loading={busy}
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </Button>
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <Field name="email">
            <FieldLabel>Email</FieldLabel>
            <Input type="email" name="email" autoComplete="email" required disabled={busy} />
          </Field>
          <Field name="password">
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
              name="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={6}
              required
              disabled={busy}
            />
          </Field>
          <Button type="submit" loading={busy}>
            {mode === "sign-up" ? "Create account" : "Sign in"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError("");
              setMessage("");
            }}
          >
            {mode === "sign-in" ? "Create an account" : "Already have an account? Sign in"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </section>
  );
}
