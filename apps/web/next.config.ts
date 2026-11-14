import type { NextConfig } from "next";

const config: NextConfig = {
  // Keep Playwright's dev server independent of an existing pnpm dev session.
  distDir: process.env.PLAYWRIGHT_TEST === "1" ? ".next-e2e" : ".next",
  // The development badge otherwise overlaps the account menu's logout trigger.
  devIndicators: process.env.PLAYWRIGHT_TEST === "1" ? false : undefined,
};

export default config;
