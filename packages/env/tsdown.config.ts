import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/*.ts"],
  root: "src",
  report: false,
  platform: "neutral",
  target: "es2022",
  unbundle: true,
  deps: { neverBundle: true },
  dts: { sourcemap: true },
  sourcemap: true,
  // Resolve local subpath imports from source while packaging.
  inputOptions: { resolve: { conditionNames: ["source"] } },
});
