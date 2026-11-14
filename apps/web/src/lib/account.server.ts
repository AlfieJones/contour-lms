import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "#lib/orpc.server.ts";

export const getCurrentAccount = cache(() => serverClient.user.get());

export async function requireAccount() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  return account;
}
