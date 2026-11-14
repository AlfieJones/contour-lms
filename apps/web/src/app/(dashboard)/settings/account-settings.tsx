"use client";

import { useForm } from "react-hook-form";
import { useEffect, useState, type FormEventHandler, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account } from "@lms/api";
import { Avatar, AvatarFallback, AvatarImage } from "@lms/ui/avatar";
import { Button } from "@lms/ui/button";
import {
  Card,
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardFrameFooter,
  CardPanel,
} from "@lms/ui/card";
import { Field, FieldLabel, FieldDescription } from "@lms/ui/field";
import { Input } from "@lms/ui/input";
import { toastManager } from "@lms/ui/toast";
import { FormError } from "#components/form-error.tsx";
import { getSupabaseBrowserClient } from "#lib/supabase.ts";
import { orpc } from "#lib/orpc.ts";

export function AccountSettings({ account }: { account: Account }) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <ProfileSettings account={account} />
      <PasswordSettings />
      <SessionSettings />
    </div>
  );
}

function ProfileSettings({ account }: { account: Account }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const save = useMutation(
    orpc.user.update.mutationOptions({
      onSuccess: async () => {
        await Promise.all(
          [
            orpc.user.get.key(),
            orpc.enrolment.key(),
            orpc.admin.users.list.key(),
            orpc.consultation.list.key(),
            orpc.admin.consultations.key(),
          ].map(async (queryKey) => {
            await queryClient.cancelQueries({ queryKey });
            await queryClient.invalidateQueries({ queryKey });
          }),
        );
      },
    }),
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState(account.avatarUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting: pending },
  } = useForm({
    defaultValues: { name: account.name ?? "" },
    shouldUseNativeValidation: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function submit(values: { name: string }) {
    const name = values.name.trim();
    setError("");
    const storage = getSupabaseBrowserClient().storage.from("avatars");
    let uploadedPath: string | null = null;
    try {
      let avatarUrl = photoUrl;
      if (photo) {
        const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
          photo.type
        ];
        if (!extension || photo.size > 2 * 1024 * 1024)
          throw new Error("Choose a JPG, PNG, or WebP photo under 2 MB.");
        const path = `${account.id}/${crypto.randomUUID()}.${extension}`;
        const result = await storage.upload(path, photo, {
          contentType: photo.type,
          upsert: false,
        });
        if (result.error) throw new Error("Couldn’t upload your photo. Please try again.");
        uploadedPath = path;
        avatarUrl = storage.getPublicUrl(path).data.publicUrl;
      }
      await save.mutateAsync({ name, avatarUrl });
      // Delete only this user's previous Storage photo, after its replacement is saved.
      const prefix = storage.getPublicUrl(`${account.id}/`).data.publicUrl;
      if (account.avatarUrl?.startsWith(prefix) && account.avatarUrl !== avatarUrl) {
        await storage
          .remove([`${account.id}/${account.avatarUrl.slice(prefix.length).split("?")[0]}`])
          .catch(() => undefined);
      }
      setPhotoUrl(avatarUrl);
      setPhoto(null);
      setPreview(null);
      setFileKey((key) => key + 1);
      router.refresh();
      toastManager.add({ type: "success", title: "Profile saved." });
    } catch (cause) {
      if (uploadedPath) await storage.remove([uploadedPath]).catch(() => undefined);
      setError(
        cause instanceof Error ? cause.message : "Couldn’t save your profile. Please try again.",
      );
    }
  }

  return (
    <SettingsSection
      id="profile"
      title="Profile"
      onSubmit={handleSubmit(submit)}
      footer={
        <Button type="submit" loading={pending}>
          Save changes
        </Button>
      }
    >
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">Personal details</legend>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            {(preview || photoUrl) && (
              <AvatarImage src={preview || photoUrl || undefined} alt="Your profile photo" />
            )}
            <AvatarFallback>
              {(account.name || account.email).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="profile-photo">Profile photo</FieldLabel>
              <Input
                key={fileKey}
                id="profile-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (
                    file &&
                    (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
                      file.size > 2 * 1024 * 1024)
                  ) {
                    setError("Choose a JPG, PNG, or WebP photo under 2 MB.");
                    event.target.value = "";
                    return;
                  }
                  setError("");
                  setPhoto(file);
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
              <FieldDescription>JPG, PNG or WebP · 2 MB max · Public</FieldDescription>
            </Field>
            {(photo || photoUrl) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  setPhoto(null);
                  setPreview(null);
                  setPhotoUrl(null);
                  setFileKey((key) => key + 1);
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <Field name="name">
          <FieldLabel htmlFor="profile-name">Name</FieldLabel>
          <Input
            nativeInput
            id="profile-name"
            {...register("name", { validate: (value) => !!value.trim() || "Enter your name." })}
            type="text"
            autoComplete="name"
            required
            maxLength={100}
          />
        </Field>
      </fieldset>
      <FormError message={error} />
    </SettingsSection>
  );
}

function useSecurityAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run };
}

function PasswordSettings() {
  const action = useSecurityAction();
  const { register, handleSubmit, reset } = useForm({
    defaultValues: { password: "", confirmPassword: "", nonce: "" },
    shouldUseNativeValidation: true,
    shouldUnregister: true,
  });
  const [needsCode, setNeedsCode] = useState(false);
  const [notice, setNotice] = useState("");
  async function sendCode() {
    const { error } = await getSupabaseBrowserClient().auth.reauthenticate();
    if (error) throw error;
    setNeedsCode(true);
    setNotice("A verification code has been sent to your email.");
  }
  async function submit(values: { password: string; confirmPassword: string; nonce: string }) {
    await action.run(async () => {
      setNotice("");
      const password = values.password;
      const nonce = values.nonce?.trim();
      const { error } = await getSupabaseBrowserClient().auth.updateUser({
        password,
        ...(nonce ? { nonce } : {}),
      });
      if (error?.code === "reauthentication_needed") {
        await sendCode();
        return;
      }
      if (error) throw error;
      reset();
      setNeedsCode(false);
      setNotice("Your password has been updated.");
    });
  }
  return (
    <SettingsSection
      id="security"
      title="Password"
      onSubmit={handleSubmit(submit)}
      footer={
        <>
          {needsCode && (
            <Button
              type="button"
              variant="outline"
              disabled={action.pending}
              onClick={() => void action.run(sendCode)}
            >
              Resend code
            </Button>
          )}
          <Button type="submit" loading={action.pending}>
            Update password
          </Button>
        </>
      }
    >
      <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="sr-only">New password</legend>
        <Field name="password" disabled={action.pending}>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input
            nativeInput
            id="new-password"
            {...register("password", { required: "Enter a new password." })}
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={action.pending}
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
        <Field name="confirmPassword" disabled={action.pending}>
          <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
          <Input
            nativeInput
            id="confirm-password"
            {...register("confirmPassword", {
              required: "Confirm your new password.",
              validate: (value, values) =>
                value === values.password || "The passwords don’t match.",
            })}
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={action.pending}
          />
        </Field>
      </fieldset>
      {needsCode && (
        <Field name="nonce" disabled={action.pending}>
          <FieldLabel htmlFor="password-nonce">Email verification code</FieldLabel>
          <Input
            nativeInput
            id="password-nonce"
            {...register("nonce", { required: "Enter the email verification code." })}
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            required
            disabled={action.pending}
          />
        </Field>
      )}
      <FormError message={action.error} />
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </SettingsSection>
  );
}

function SessionSettings() {
  const action = useSecurityAction();
  const [notice, setNotice] = useState("");
  return (
    <SettingsSection
      id="sessions"
      title="Sessions"
      footer={
        <Button
          type="button"
          variant="outline"
          loading={action.pending}
          onClick={() =>
            void action.run(async () => {
              setNotice("");
              const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "others" });
              if (error) throw error;
              setNotice("Your other sessions have been signed out.");
            })
          }
        >
          Sign out other devices
        </Button>
      }
    >
      <p role={notice ? "status" : undefined} className="text-sm text-muted-foreground">
        {notice || "You’ll stay signed in on this device."}
      </p>
      <FormError message={action.error} />
    </SettingsSection>
  );
}

function SettingsSection({
  id,
  title,
  children,
  footer,
  onSubmit,
}: {
  id: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
  return (
    <CardFrame
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-6"
      render={onSubmit ? <form onSubmit={onSubmit} /> : <section />}
    >
      <CardFrameHeader>
        <CardFrameTitle id={`${id}-title`} render={<h2 />}>
          {title}
        </CardFrameTitle>
      </CardFrameHeader>
      <Card>
        <CardPanel className="flex flex-col gap-4">{children}</CardPanel>
      </Card>
      {footer && (
        <CardFrameFooter className="flex flex-wrap justify-end gap-2">{footer}</CardFrameFooter>
      )}
    </CardFrame>
  );
}
