import { serverEnvSchema, validate } from "@lms/env";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

loadEnvConfig(
  resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  process.env.NODE_ENV !== "production",
  console,
  true,
);

validate(serverEnvSchema, process.env, "server");

const config: NextConfig = {};

export default config;
