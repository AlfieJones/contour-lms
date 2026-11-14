"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@lms/ui/button";
import { Field, FieldLabel } from "@lms/ui/field";
import { Form } from "@lms/ui/form";
import { Input } from "@lms/ui/input";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@lms/ui/select";
import { FormError } from "#components/form-error.tsx";
import { getSupabaseBrowserClient } from "#lib/supabase.ts";
import { formText } from "#lib/form.ts";

export function MfaChallenge({ factors }: { factors: { id: string; label: string }[] }) {
  const [factorId, setFactorId] = useState(factors[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const code = formText(new FormData(event.currentTarget), "code").trim();
    setPending(true);
    setError("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({
        factorId,
        code,
      });
      if (error) throw error;
      window.location.assign("/settings/security");
    } catch {
      setError("Couldn’t verify this code. Enter the latest code from your authenticator app.");
      setPending(false);
    }
  }
  return (
    <Form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      {factors.length > 1 && (
        <Field disabled={pending}>
          <FieldLabel>Authenticator</FieldLabel>
          <Select
            items={factors.map((factor) => ({ value: factor.id, label: factor.label }))}
            value={factorId}
            onValueChange={(value) => {
              if (value) setFactorId(value);
            }}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectGroup>
                {factors.map((factor) => (
                  <SelectItem key={factor.id} value={factor.id}>
                    {factor.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectPopup>
          </Select>
        </Field>
      )}
      {factors.length ? (
        <>
          <Field name="code" disabled={pending}>
            <FieldLabel>Authenticator code</FieldLabel>
            <Input
              name="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              autoFocus
              disabled={pending}
            />
          </Field>
          <Button type="submit" loading={pending}>
            Verify and continue
          </Button>
        </>
      ) : (
        <p role="alert" className="text-sm">
          No supported authenticator is available. Contact your administrator for help accessing
          your account.
        </p>
      )}
      <FormError message={error} />
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
          if (error) {
            setError("Couldn’t log out. Please try again.");
            setPending(false);
            return;
          }
          window.location.assign("/login");
        }}
      >
        Log out
      </Button>
    </Form>
  );
}
