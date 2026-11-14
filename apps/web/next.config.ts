import { loadEnvConfig } from "@next/env";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const monorepoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default async function config(): Promise<NextConfig> {
  // Next already loaded app-local env files; reload from the monorepo root.
  loadEnvConfig(monorepoRoot, process.env.NODE_ENV === "development", console, true);
  await import("@lms/env/server");

  return {};
}
