import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.tsx", "src/server.ts", "src/sender.ts"],
  platform: "node",
  deps: { neverBundle: true },
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  dts: true,
});
