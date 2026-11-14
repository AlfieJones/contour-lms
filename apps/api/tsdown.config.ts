import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/context.ts",
    "src/procedures.ts",
    "src/routers/consultation-scheduling.ts",
  ],
  root: "src",
  // Node builds must match the .js/.d.ts package subpaths.
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  report: false,
  platform: "node",
  target: "es2022",
  unbundle: true,
  deps: { neverBundle: true },
  dts: { sourcemap: true },
  sourcemap: true,
  // Resolve local subpath imports from source while packaging.
  inputOptions: { resolve: { conditionNames: ["source"] } },
});
