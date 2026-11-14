"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@lms/ui/button";
import { getSupabaseBrowserClient } from "#lib/supabase.ts";

export function LogoutButton() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setPending(true);
    setError("");
    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut({
        scope: "local",
      });
      if (signOutError) throw signOutError;
      queryClient.clear();
      window.location.assign("/login");
    } catch {
      setError("Could not log out. Try again.");
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" loading={pending} onClick={logout}>
        Log out
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
