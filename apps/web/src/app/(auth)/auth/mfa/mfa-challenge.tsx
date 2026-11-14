"use client";

import { useController, useForm } from "react-hook-form";
import { useState } from "react";
import { Button } from "@lms/ui/button";
import { Field, FieldLabel } from "@lms/ui/field";
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

export function MfaChallenge({ factors }: { factors: { id: string; label: string }[] }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: { code: "", factorId: factors[0]?.id ?? "" },
    shouldUseNativeValidation: true,
  });
  const {
    field: { ref: factorRef, onBlur: onFactorBlur, ...factor },
  } = useController({ name: "factorId", control });
  const [signingOut, setSigningOut] = useState(false);
  const pending = isSubmitting || signingOut;
  const [error, setError] = useState("");
  async function submit(values: { code: string; factorId: string }) {
    setError("");
    try {
      const { error } = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({
        factorId: values.factorId,
        code: values.code.trim(),
      });
      if (error) throw error;
      window.location.assign("/settings/security");
    } catch {
      setError("Couldn’t verify this code. Enter the latest code from your authenticator app.");
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      {factors.length > 1 && (
        <Field disabled={pending}>
          <FieldLabel>Authenticator</FieldLabel>
          <Select
            items={factors.map((factor) => ({ value: factor.id, label: factor.label }))}
            name={factor.name}
            value={factor.value}
            onValueChange={factor.onChange}
            disabled={pending}
          >
            <SelectTrigger ref={factorRef} onBlur={onFactorBlur}>
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
            <FieldLabel htmlFor="mfa-code">Authenticator code</FieldLabel>
            <Input
              nativeInput
              id="mfa-code"
              {...register("code", {
                required: "Enter your authenticator code.",
                pattern: { value: /^[0-9]{6}$/, message: "Enter a six-digit code." },
              })}
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
          setSigningOut(true);
          const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
          if (error) {
            setError("Couldn’t log out. Please try again.");
            setSigningOut(false);
            return;
          }
          window.location.assign("/login");
        }}
      >
        Log out
      </Button>
    </form>
  );
}
